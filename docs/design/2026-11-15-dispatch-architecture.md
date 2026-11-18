# 派单架构设计

日期：2026-11-15

> **📌 本文只讲「代码放哪、怎么分层」。**
> 派单**策略**（分档阈值、排序规则、推送节奏、抢单防护）以
> [`2026-11-15-dispatch-strategy.md`](./2026-11-15-dispatch-strategy.md) 为准。
> 本文提到的「四波」「加权随机」等属于当时的初版实现，已被策略文档取代。

---

## 1. 要解决的问题

把 `docs/design/2026-11-08-dispatch-design.md` 里描述的四波 + 三层漏斗，落成可运行的代码。代码放在 `apps/server/dispatch`。

参考材料是滴滴的算法备案公示文档（`C:\Users\EDY\Downloads\default (1).pdf`），其中第七节「用车服务分单算法」跟我们最相关：配对 → 过滤 → 算分 → 匹配，最大原则是就近派单，距离相同看口碑值。

---

## 2. 现状

| 位置 | 现状 |
|---|---|
| `apps/server/` | **空壳**。8 个目录（config/dispatch/geo/identity/notification/payment/pricing/trip）各只有一个 `.gitkeep`，没有 `package.json` |
| `apps/api/` | NestJS 单体，29 条路由，已实现订单、司机、乘客、车型 |
| 当前派单方式 | **抢单**：`orders.service.ts` 的 `waitingForDriver()` 返回等待列表，司机自己 `accept()` |
| 目标派单方式 | **纯后台派单**：司机看不到列表，系统按算法推给他 |

这两者方向相反，改造时要动的不只是新增代码。

---

## 3. 架构选择

`apps/server` 有三种做法，差别在于「它是什么」：

### 方案 A · 独立微服务

`apps/server` 有自己的 `package.json`、独立端口（3001）、独立进程，直连同一个 PostgreSQL。

- **优点**：独立部署、独立扩容、故障隔离
- **缺点**：两个服务写同一个库，订单状态要跨服务同步；本地开发要起两个进程；没有服务发现和链路追踪，出问题难查

### 方案 B · 纯算法库（推荐）

`apps/server` 是一个**不含框架依赖的 TypeScript 库**，只做「给一批候选司机和一张订单，返回该推给谁」这一件事。通过 npm 的 `file:` 依赖被 `apps/api` 引用。

- **优点**：纯函数、无副作用，最好写单测；职责边界清楚；将来真要拆微服务，这个库可以原样搬走
- **缺点**：改完要先 `npm run build --prefix apps/server`，`apps/api` 才能拿到新代码

### 方案 C · 直接放 `apps/api/src/dispatch/`

放弃 `apps/server` 这个目录。

- **优点**：零配置，`nest build` 一次搞定
- **缺点**：不符合「派单算法单独一个目录」的规划

### 为什么选 B

派单的核心是**选谁**（算法），不是**怎么存**（基础设施）。

- 定时器、状态机、数据库读写，`apps/api` 已经有了，不需要重造
- 算法本身是纯函数：输入候选集，输出选中的人，不碰数据库、不发请求
- 纯函数可以脱离数据库跑单测，几百个用例一秒跑完；如果做成微服务，每个用例都要起容器

方案 A 的复杂度只有在「派单量级大到单机扛不住」时才值得付。现在一个县城的订单量，远没到那一步。

---

## 4. 模块划分

实际结构（初版的 `wave.ts` / `weighted.ts` / `score/idle.ts` / `surge.ts` 已删除）：

```
apps/server/
├── package.json              # name: @onesoon/dispatch, type: module
├── tsconfig.json
└── dispatch/
    ├── index.ts              # 对外入口，只导出 dispatch()
    ├── types.ts              # 输入输出类型 + DEFAULT_TUNING 可调参数
    ├── geo.ts                # 直线距离、ETA 估算
    ├── funnel/
    │   ├── filter.ts         # 第一层 · 资格过滤
    │   ├── bucket.ts         # 第二层 · ETA 分档
    │   └── rank.ts           # 第三层 · 同档排序（ETA → 服务分 → 今日单数）
    └── __tests__/            # 5 个文件 52 个用例
```

细节和「为什么」写在 [`apps/server/dispatch/README.md`](../../apps/server/dispatch/README.md)。

**为什么按漏斗分层拆文件**：三层漏斗各自是独立的判断，任何一层改规则都不该影响另外两层。拆开之后，`filter.ts` 的测试不需要构造 ETA 数据，`bucket.ts` 的测试不需要构造服务分。

---

## 5. 数据流

```
apps/api 的调度器（每 15 秒一次）
        │
        ├─ 1. 查库：待派订单 + 候选司机（在线 + 位置新鲜 + 手上单数 + 今日单数）
        ├─ 2. 查库：已推过的司机 + 算好每位司机的接驾 ETA
        │
        ▼
   @onesoon/dispatch（纯函数）
        │
        ├─ filterCandidates(candidates, order, tuning, now)  → 合格司机 + 排除原因
        ├─ bucketByEta(qualified, etaMinutes, tuning)        → 按 ETA 分档
        └─ rankInBucket(topBucket, toleranceMinutes)         → 选一个
        │
        ▼
   apps/api 写回：dispatch_offer 表 + 司机端轮询拿推送
```

**调度器留在 `apps/api` 的理由**：它要读写数据库、要起定时器、要处理并发（同一时刻只有一个波次在跑），这些都是基础设施职责，跟算法无关。

---

## 6. 接口契约

```ts
// 输入：一次派单尝试（类型定义见 apps/server/dispatch/types.ts）
interface DispatchInput {
  order: DispatchOrder;                  // id、起终点、offeredDriverIds（这单推过谁）
  candidates: readonly DriverCandidate[]; // id、位置、位置更新时间、服务分、手上单数、今日单数
  etaMinutes: ReadonlyMap<string, number>; // 每位司机到上车点的接驾时间，由调用方算
  now: number;                           // 当前时间戳，传进来而不是内部取 Date.now()，单测才确定
}

// 输出：选中的人 + 为什么
type DispatchResult =
  | { ok: true; picked: DriverCandidate; bucket: "A" | "B" | "C" | "D"; qualifiedCount: number }
  | { ok: false; reason: "no-candidate" | "all-excluded" | "stale-location"; qualifiedCount: number };
```

**为什么返回 `reason`**：派单失败时，运营要能回答「为什么这单没派出去」——是没司机在线，
还是都推过了，还是所有司机的位置都过期了。只返回空数组，事后查不出来。

**为什么 `etaMinutes` 由调用方传**：将来换成高德真实路面距离，只改调用方算 ETA 那一步，算法一行不用动。

---

## 7. 与现有代码的关系

| 现有代码 | 改造 |
|---|---|
| `apps/api/src/orders/orders.service.ts` 的 `waitingForDriver()` | 删掉。司机不再拉列表 |
| 同文件的 `accept()` | 保留，但改成「只能接推给自己的单」 |
| `apps/api/src/drivers/drivers.controller.ts:43` 的 `accept` 路由 | 同上，加校验 |
| `apps/driver/src/pages/dispatch/dispatch.vue` | 删掉。派单大厅这个页面跟纯后台派单冲突 |
| `apps/driver/src/pages.json` 的 `pages/dispatch/dispatch` | 删掉 |
| 数据库 | 新增 `dispatch_offer` 表；`driver` 加 `longitude` / `latitude` / `location_updated_at` |

---

## 8. 实施步骤

1. **建库**：`apps/server/package.json` + `tsconfig.json`，`apps/api` 加 `file:` 依赖
2. **写类型**：`types.ts` 定义输入输出
3. **写三层漏斗**：每层一个纯函数，配单测
4. **写调度器**：`apps/api/src/dispatch/`，定时器 + 数据库读写
5. **改订单状态机**：`waiting` 拆成 `dispatching`（找司机中）和 `waiting`（已推给某人）
6. **改司机端**：删派单大厅，加推单弹层

第 3 步做完就能跑单测验证算法，不用等数据库和前端。

---

## 9. 还没定的

- **司机位置从哪来**：H5 的 `uni.getLocation` 需要 HTTPS 或 localhost，生产环境要配证书；上报频率、超时判定都还没定
- **服务分第一期全是 4.8**：加权随机退化成均匀随机，这是预期行为，不是 bug
- **加价后的波次**：设计文档说「只找一轮」，但没说是从当前半径继续还是从 13 km 重新开始

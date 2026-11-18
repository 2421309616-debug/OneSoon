# 派单算法库（`@onesoon/dispatch`）

这个目录回答**一个问题**：

> 一笔订单，此刻该推给哪个司机？

它只做这一件事，而且只做纯计算：**不读数据库、不发 HTTP 请求、不看系统时间**。
所有输入（司机坐标、ETA、当前时间戳）都由调用方传进来，所以几百个用例能在一秒内跑完。

设计文档：

- [`dispatch-strategy.md`](./dispatch-strategy.md) —— **先读这个**。为什么这么派（分档阈值、排序规则、推送节奏、抢单防护），857 行，含依据来源。
- [`../../docs/design/2026-11-15-dispatch-architecture.md`](../../docs/design/2026-11-15-dispatch-architecture.md) —— 为什么单独成库、为什么调度器留在 `apps/api`。

> 两份文档都是会变的：策略那份在本目录有一份副本，**以 `docs/design/` 下的为准**。

---

## 在系统里的位置

```
apps/api 每 15 秒跑一轮调度器（apps/api/src/dispatch/dispatch.service.ts）
        │
        ├─ 查库：待派订单 + 候选司机（在线 / 位置新鲜 / 手上单数 / 今日接单数）
        │        并算好每位司机的接驾 ETA
        ▼
   @onesoon/dispatch   ← 本库（纯函数，一次调用只选一个人）
        │
        ▼
   apps/api 写回：dispatch_offer 表（推送记录），司机端轮询拿推送
```

引用方式：`apps/api/package.json` 里 `"@onesoon/dispatch": "file:../server"`。
因为 `main` 指向 `dist/index.js`，**改完本库必须 `npm run build`，`apps/api` 才能拿到新代码**。

时间参数不在这里，在调用方：

| 参数 | 值 | 在哪 |
|---|---|---|
| 调度频率 `TICK_MS` | 15 秒 | `apps/api/src/dispatch/dispatch.service.ts` |
| 换人节奏 `REPUSH_AFTER_MS` | 30 秒 | 同上 |
| 推送有效期 `OFFER_TTL_MS` | 60 秒 | 同上 |
| 位置过期 `LOCATION_TTL_MS` | 60 秒 | 同上（算法侧 `DEFAULT_TUNING.locationTtlMs` 也是 60 秒） |

换成高德真实路面距离时，只需要改调用方算 ETA 的那一步，**本库一行不用动**。

---

## 目录

```
apps/server/dispatch/
├── index.ts             # 唯一入口：dispatch()
├── types.ts             # 输入输出类型 + DEFAULT_TUNING（所有可调参数集中在这）
├── geo.ts               # 直线距离、ETA 估算（直线 × detourFactor ÷ 平均车速）
├── funnel/
│   ├── filter.ts        # 第一层 · 资格过滤：能不能
│   ├── bucket.ts        # 第二层 · 就近分档：谁更近
│   └── rank.ts          # 第三层 · 同档排序：一样近时选谁
└── __tests__/           # 5 个文件、52 个用例，纯函数，不需要数据库
```

### 三层漏斗各管什么

**第一层 `filterCandidates`** —— 只回答「能不能」，不打分。四条硬条件，按「便宜的先算」排：

1. 这一单没推过这个司机（集合查找）
2. 手上订单数 < `maxActiveOrders`（默认 3）
3. 位置没超过 `locationTtlMs`（默认 60 秒）—— 旧位置算出来的距离没有意义
4. 直线距离 ≤ `maxDistanceMeters`（默认 10 km）
   —— 这是**粗筛**不是分档，只排除跨镇跨区的明显不可能；接高德 API 后，这一层能挡掉大部分调用量

被排除的每个司机都带一个原因（`already-offered` / `too-many-orders` / `stale-location` / `out-of-range`），
给运营日志用：派不出去时要能回答「是没人，还是都推过了」。

**第二层 `bucketByEta`** —— 按接驾时间分档：A ≤ 3 分钟、B ≤ 6、C ≤ 12、D > 12。
只分档不做选择，每档内按 ETA 升序。

**第三层 `rankInBucket`** —— 从最靠前的非空档里选一个人，三步：

1. 找该档最快的那个
2. 和它差 < `sameBucketToleranceMinutes`（默认 1 分钟）的算「一样快」
3. 一样快时：服务分降序 → 今日接单数升序

**为什么不是加权随机**：滴滴算法备案公示的原话是「若距离相同，则会派给口碑值分数更高的司机」——
口碑值是 **tiebreak，不是权重**。加权随机会出现「3 公里外的 5.0 分司机压过 200 米外的 4.8 分司机」，
乘客等更久，违背「就近派单是最大原则」。

---

## 一次只推一个

`dispatch()` 每次只返回**一位**司机。同一笔订单的重叠是由调用方造成的：
换人节奏 30 秒 < 推送有效期 60 秒，所以第 30 秒时这一单**同时挂在两位司机手上**。

谁先接谁得，靠 `apps/api/src/orders/orders.service.ts` 的 `accept()`：
事务 + `SELECT ... FOR UPDATE` 行锁 + `UPDATE ... WHERE status = 'waiting'` 乐观锁 + 把该单其它 pending 推送置 `expired`。
**并发安全不是本库的责任**，本库是纯函数，碰不到数据库。

---

## 已实现 / 未实现

已实现（第一阶段）：

- ✅ 资格过滤 → ETA 分档 → 同档排序的完整漏斗
- ✅ 串行推送 + 每轮一人 + 30 秒换人（调用方节奏）
- ✅ 抢单乐观锁（调用方）
- ✅ 司机位置上报与 60 秒过期

未实现（见策略文档 §9）：

- ⬜ 高德真实路面距离 —— 现在 ETA = 直线距离 × 1.3 ÷ 30km/h
- ⬜ 服务分体系与评价 —— 现在所有司机固定 4.80，第二档比较退化成「今日接单数升序」
- ⬜ 边缘加价（+3 / +6 / +10）—— 只设计了没写
- ⬜ 预约单提前派单
- ⬜ 订单 7 态状态机（库里只有 `waiting` / `accepted` / `cancelled`）

---

## 跑测试

```bash
npm --prefix apps/server install    # 首次
npm --prefix apps/server test       # 52 个用例，不需要数据库、不需要起服务
npm --prefix apps/server run build  # 改完要让 apps/api 用上，必须 build
```

调参就在 `types.ts` 的 `DEFAULT_TUNING`，单测会覆盖边界值；
改完记得跑 `npm --prefix apps/server test` 和 `npm --prefix apps/api run build`。

---

## 给接手的人：先看哪

1. `dispatch-strategy.md` 的 §二（设计总览）和 §四（四步流程）—— 半小时能理解全貌
2. `index.ts` —— 86 行，三层漏斗串起来的全部逻辑
3. `__tests__/dispatch.test.ts` —— 端到端场景，比注释更直观

数据库怎么建、`dispatch_offer` 的约束为什么这么设计，见
[`../../apps/api/src/database/README.md`](../../apps/api/src/database/README.md)。

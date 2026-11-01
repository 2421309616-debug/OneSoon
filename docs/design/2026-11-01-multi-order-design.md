# 司机端「多单并行」设计

- 日期：2026-11-01
- 范围：`apps/driver`（uni-app H5，演示数据）
- 状态：待批准

## 1. 意图

现在司机一次只能拿一单：接了就被拽进行程页，跑完结算才能回听单。真实司机在高峰时段会连着接两三单，趁顺路一起跑。

这次要让司机**手上同时挂多单**，每单自己走自己的进度，想先跑哪单由司机决定，没有强制顺序。

## 2. 目标

- 司机可以同时持有最多 3 个已接订单
- 点「立即接单」后**留在听单页**，可以继续接下一单
- 每一单的行程阶段（前往上车点 / 等待上车 / 前往目的地 / 结算）**独立保存**
- 司机可以从听单页、行程中面板、订单页任一处进入某一单的行程页
- 中途退出行程页不丢进度，切到另一单再切回来，原来那单停在哪一步还是哪一步
- 每单单独结算，结算后从「进行中」移到「已完成」，统计 +1 单 +车费

## 3. 非目标

- 不做拼车调度、不做顺路排序、不做路线合并
- 不做服务端同步（仍是本地演示数据）
- 不做订单持久化（刷新页面，在手订单清空，与现状一致）
- 不做接单上限的运营配置，3 单写死为常量

## 4. 反目标（做出来就算失败）

- 出现「同一单可以被接两次」
- 切单后回来发现进度被重置或错位
- 听单页因为手上有单就再也接不了新单
- 地图上同时画三条路线导致看不清

## 5. 方案

| | 一：订单池 ✅ | 二：主副单 | 三：全并行卡片 |
|---|---|---|---|
| 每单进度 | 各存各的 | 切走要转存 | 各存各的 |
| 切换 | 天然支持 | 手动迁移，易丢状态 | 不用切 |
| 改动量 | 中 | 小但脆 | 中 |
| 手感 | 清楚 | 别扭 | 拥挤，地图无法承载 |

**选定方案一。** 理由：把「订单的阶段」放回订单自己身上，是数据模型本该有的形状。方案二省下的改动量会以「切单后状态错乱」的形式还回来。

## 6. 数据模型

### 6.1 类型

```ts
/** 已接、未完成的订单，阶段存在自己身上 */
export type ActiveOrder = TripOrder & {
  stage: TripStage;
  /** 接单时间戳，列表按它倒序 */
  acceptedAt: number;
};

/** 司机自身的状态，不再表达行程进度 */
export type DriverPhase = "offline" | "listening" | "offering";
```

`TripStage` 沿用现有的 `"toPickup" | "waiting" | "inTrip" | "settling"`。

### 6.2 全局状态

```ts
export const driverState = reactive({
  driver: DriverSession | null,
  phase: DriverPhase,          // offline | listening | offering
  order: TripOrder | null,     // 仅 offering 时有值：正在看详情的推单
  offerSeconds: number,
  pool: PoolOrder[],           // 附近订单（未接）
  orders: ActiveOrder[],       // 在手订单（已接未完成）
  completed: CompletedOrder[],
  stats: { orders: number; income: number; onlineSeconds: number },
});
```

关键收窄：**`phase` 不再包含四个行程阶段**，它们下放到 `ActiveOrder.stage`。这是本次改动的核心。

### 6.3 常量

```ts
export const MAX_ACTIVE_ORDERS = 3;
```

### 6.4 函数签名变化

| 现在 | 改为 | 说明 |
|---|---|---|
| `hasActiveTrip(): boolean` | `hasActiveTrip(): boolean` | 实现变成 `orders.length > 0` |
| `advancePhase()` | `advanceOrderStage(id: string)` | 推进指定单的阶段 |
| `acceptOffer(): TripOrder \| null` | `acceptOffer(): ActiveOrder \| null` | 入 `orders`，`phase` 回 `listening` |
| — | `findActiveOrder(id): ActiveOrder \| undefined` | 供行程页按 id 取单 |
| — | `activeTripStageText(order): string` | 卡片上的阶段文案 |
| `resetToListening()` | 删除 | 不再有「全局行程状态」可重置 |

`goOffline()` 保留：`orders.length > 0` 时返回 `false`。

## 7. 各页面行为

### 7.1 首页：有单时也停在听单页

现在 `home.vue` 的模板是 `activeTrip ? ActiveTripPanel : ListeningPanel` 二选一，所以接了单之后就只剩「继续处理行程」，回不到听单页。改成：

```
phase === "offline" ? OfflinePanel : ListeningPanel
```

有单没单都停在听单页。

### 7.2 听单页 `ListeningPanel`

- 顶部统计下方插入「进行中（N）」区，只在 `orders.length > 0` 时出现
- 每张卡片：起终点一行、阶段徽标（前往上车点 / 等待上车 / 前往目的地 / 结算）、右侧箭头
- 点卡片 → `uni.navigateTo('/pages/trip/trip?id=' + order.id)`
- 下方「附近订单」列表不变
- 接单成功后**不跳转**，停留在本页；新接的单立刻出现在「进行中」区
- 已到 3 单上限时，接单按钮文案变「手上已有 3 单」，点击弹提示而不是接单

### 7.3 `ActiveTripPanel.vue` 删除

它现在承载的「行程中」信息全部并入听单页的进行中区。卡片样式（红色阶段徽标、四步进度点）搬到 `ListeningPanel` 里复用。

### 7.4 行程页 `trip.vue`

- 通过 `onLoad(options => id = options.id)` 取当前单
- `const current = computed(() => findActiveOrder(orderId))`
- 找不到 id 或单已不存在 → 现有空态（「没有进行中的行程」）
- 所有阶段判断改读 `current.stage`
- 主按钮文案读 `TRIP_STAGE_ACTION[current.stage]`
- 底部白色面板顶部加**四步阶段进度条**（接驾 / 等候 / 行程 / 结算），当前阶段红色高亮、已完成阶段实心点、未到达灰色——与听单页进行中卡片共用同一套样式
- 「确认收款」→ `advanceOrderStage(id)` 把单移入 `completed` → 回 home
- 左上返回 → 回 home（暂离），进度不动

### 7.5 订单页 `orders.vue`

- 「进行中」tab 从单卡改为列表，渲染全部 `orders`
- 每行右侧显示阶段文案，点击进对应行程页
- 「已完成」tab 不变（`driverState.completed` 在最前）

### 7.6 地图

- 行程页只画当前这一单的路线（起点绿点、终点红针）
- 不做多路线叠加

## 8. 边界情况

| 情况 | 行为 |
|---|---|
| 同一单重复接 | `acceptOffer` 先查 `orders.some(o => o.id === order.id)`，已存在则忽略 |
| 接单时池子到期 | 沿用现有逻辑：`openOrder` 打开后若池中该单到期消失，弹层自动关闭 |
| 手上有单时收车 | `goOffline()` 返回 `false`，toast「请先完成当前订单」 |
| 行程页 URL 里的 id 不存在 | 显示现有空态页 |
| 结算最后一单 | `orders` 空了，`hasActiveTrip()` 变 `false`，home 自动回到听单/未出车面板 |
| 3 单上限 | 接单入口禁用并提示，不静默失败 |

## 9. 改动清单

| 文件 | 改动性质 |
|---|---|
| `apps/driver/src/driver-state.ts` | 重构：`ActiveOrder`、`orders[]`、`phase` 收窄、阶段函数按 id |
| `apps/driver/src/components/ListeningPanel.vue` | 新增「进行中」区 + 接单上限提示 |
| `apps/driver/src/components/ActiveTripPanel.vue` | **删除**，内容并入听单页 |
| `apps/driver/src/pages/trip/trip.vue` | 按 id 加载，阶段读 `current.stage`，新增四步进度条 |
| `apps/driver/src/pages/orders/orders.vue` | 「进行中」改列表 |
| `apps/driver/src/pages/home/home.vue` | 分支改成 `offline ? OfflinePanel : ListeningPanel`；接单后不跳转 |
| `apps/driver/src/mock-orders.ts` | 无需改动 |

## 10. 留给实现者的判断

- 「进行中」卡片的阶段徽标配色：沿用现有红/灰体系，不新增色
- 三单上下排列时真机一屏放不下几单，需实测滚动体验，必要时卡片高度压缩到 88rpx
- 现有 `TRIP_STAGE_ORDER` / `TRIP_STAGE_ACTION` / `PHASE_LABEL` 常量可保留复用

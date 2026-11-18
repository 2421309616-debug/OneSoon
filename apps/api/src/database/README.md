# 数据库说明

PostgreSQL 16，跑在 Docker 里（见仓库根 `docker-compose.yml`），库名固定为 `onesoon`。

**这里没有迁移框架。** 建表的唯一来源就是本目录下的 4 个 `.sql` 文件，
`DatabaseService` 在 API 启动时按固定顺序把它们幂等执行一遍。

---

## 1. 建表是怎么发生的

`apps/api/src/database/database.service.ts` 的 `onModuleInit()`：

```ts
const name = await this.currentDatabase();
if (name !== 'onesoon') {
  throw new Error(`Expected database onesoon, connected to ${name}`);
}
await this.applySchema('passenger.sql');
await this.applySchema('driver.sql');
await this.applySchema('vehicle.sql');
await this.applySchema('dispatch.sql');   // 依赖 driver 与 trip_order，必须最后
```

- **不做自动建库**：库必须已经存在。本地由 `docker compose up -d` 用 `POSTGRES_DB=onesoon` 创建。
- **连错库直接崩**：库名不是 `onesoon` 就抛 `Expected database onesoon, connected to X`，这是刻意的保护。
- **连接串**来自环境变量 `DATABASE_URL`，从仓库根 `.env` 读
  （`onesoonEnvFile()` 先找 `./.env`，再找 `../../.env`，所以从 `apps/api` 启动能找到根目录那份）。

### 顺序为什么不能换

```
passenger.sql   → passenger / passenger_place_search / trip_order
driver.sql      → driver；并给 trip_order 加 driver_id 外键
vehicle.sql     → vehicle_option
dispatch.sql    → 给 driver 加位置/服务分/状态列；建 dispatch_offer（外键指向 trip_order 和 driver）
```

`dispatch.sql` 里既有 `ALTER TABLE driver`，也有对 `trip_order` 的外键，所以必须排最后。
`driver.sql` 又要给 `trip_order` 加外键，所以排在 `passenger.sql` 之后。

### 幂等性

所有语句都是 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS` / `DROP ... IF EXISTS` + `ADD CONSTRAINT`。
每次启动重跑一遍是安全的，也**没有版本号**——想改结构，直接改对应 `.sql`，
下次启动时用 `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` 覆盖旧约束即可。

---

## 2. 表清单

| 表 | 一行是什么 | 由谁写 |
|---|---|---|
| `passenger` | 一个乘客 | 乘客端登录 |
| `passenger_place_search` | 乘客搜过的一个地点（含搜索次数） | 乘客端选目的地 |
| `trip_order` | 一笔订单 | 乘客下单、司机接单、取消 |
| `driver` | 一个司机，含认证信息、实时位置、服务分、上下线状态 | 司机端注册/上报位置/上下线 |
| `vehicle_option` | 车型图片目录（品牌/车型/颜色/视角） | 图片抓取脚本 |
| `dispatch_offer` | 一次推送：某订单推给了某司机 | 派单调度器 |

### `passenger`

`id` 是 5 位数字字符串（`^[0-9]{5}$`，如 `00001`），`phone` 唯一。

### `passenger_place_search`

复合主键 `(passenger_id, place_id)`，`search_count` 累加、`last_searched_at` 取最近一次。
目的地页的「历史地点 top3」就是按 `search_count DESC, last_searched_at DESC` 取的。

### `trip_order`

起终点各存名称 + 经纬度，`distance_meters` / `duration_seconds` / `fare_cents` 在下单时算好落库。
`status` 只有三个值：`waiting` / `accepted` / `cancelled`。

- `status = 'accepted'` ⟺ `driver_id` 和 `accepted_at` 都非空（`trip_order_accepted_matches`）
- `status = 'cancelled'` ⟺ `cancelled_at` 非空（`trip_order_cancelled_at_matches`）
- 预约单：`is_reservation = true` 配合 `scheduled_at`
- `preferences jsonb NOT NULL DEFAULT '{}'`：乘车偏好（静音/禁烟/开后备箱），
  **接口收对象** `{quietRide, smokeFree, trunkNeeded}`，传数组会报「乘车偏好格式不正确」
- 唯一索引 `trip_order_one_active_per_passenger`：
  一个乘客同时只能有一笔「进行中」的单（`accepted`，或 `waiting` 且不是预约单）。
  这是**保留**的：防止同一个乘客重复下单。
- 曾经有 `trip_order_one_accepted_per_driver`（一个司机同时只能有一笔 accepted），
  **已删除**——多单并行会直接撞 23505。现在「司机最多同时 3 单」由派单算法层控制
  （`DEFAULT_TUNING.maxActiveOrders = 3`），不再靠数据库唯一约束。

### `driver`

- `id` 5 位数字；`phone` 唯一；`id_number` 唯一（部分索引，允许为空）
- 认证字段 `id_card` / `id_number` / `driver_license` / `vehicle_license` 允许为空，
  但一旦填了就不能是空串
- 派单三要素（都在 `dispatch.sql` 里加）：`longitude` / `latitude` / `location_updated_at`、
  `service_score numeric(2,1) DEFAULT 4.8`、`status`（`online` / `offline`）
- `driver_location_pair`：经纬度必须**同时有或同时无**，避免只有一半坐标的行参与距离计算
- 索引 `driver_dispatchable_idx`：`(status, location_updated_at DESC) WHERE status = 'online'`，
  调度器每轮只有这个查询，走部分索引

### `vehicle_option`

车型图鉴的元数据，`(source_vehicle_id, color_key, view)` 唯一，`image_file` 唯一。
当前是空表（0 行），图片由 `apps/api/scripts/fetch-car-image.ts` 抓取后写入。

### `dispatch_offer`

一次推送一行。关键约束：

| 约束 | 含义 |
|---|---|
| `UNIQUE (order_id, driver_id)` | 一个订单对同一个司机**只推一次**。拒绝了、过期没看见，都算推过 |
| `status IN ('pending','accepted','rejected','expired')` | 推送的 4 个状态 |
| `(status IN ('accepted','rejected')) = (responded_at IS NOT NULL)` | 司机表过态就必须留时间；没表态（pending/expired）必须为空 |
| `expires_at > created_at` | 推送有效期 |
| `wave >= 1` | `wave` 现在的含义是「这一单的第几次推送」，不是旧的「波次半径」；列名保留没改，改要动迁移 |
| `bucket IN ('A','B','C','D')` | 推送时命中的接驾时间档位 |

索引：`dispatch_offer_pending_idx`（司机端轮询「有没有新推送」）、
`dispatch_offer_order_idx`（调度器查「这单推过谁」）。

---

## 3. 从零重建

```bash
# 连库一起清掉（会删数据卷）
docker compose down -v
docker compose up -d

# 重新启动 API，会自动把 4 个 .sql 跑一遍
npm --prefix apps/api start
```

只想重建库、保留容器：

```bash
docker exec onesoon-postgres psql -U onesoon -d postgres \
  -c "DROP DATABASE onesoon;" -c "CREATE DATABASE onesoon;"
```

然后重启 API。

---

## 4. 验证「别人 clone 下来能不能复刻出一样的库」

已经验证过一次，方法是：建一个临时库，按同样顺序跑一遍这 4 个文件，再和开发库比对结构。

```bash
# 1. 建临时库
docker exec onesoon-postgres psql -U onesoon -d postgres -c "CREATE DATABASE onesoon_verify;"

# 2. 按顺序执行（文件先在容器里）
docker cp apps/api/src/database onesoon-postgres:/tmp/schema
for f in passenger driver vehicle dispatch; do
  docker exec onesoon-postgres psql -U onesoon -d onesoon_verify -v ON_ERROR_STOP=1 -f /tmp/schema/$f.sql
done

# 3. 两边导出结构比对
docker exec onesoon-postgres pg_dump -U onesoon -d onesoon        --schema-only --no-owner --no-privileges > live.sql
docker exec onesoon-postgres pg_dump -U onesoon -d onesoon_verify --schema-only --no-owner --no-privileges > fresh.sql
diff live.sql fresh.sql
```

2026-11-18 的结果：两个库各 448 行，**只差 pg_dump 每次随机生成的 `\restrict` 标记**，
表、列、约束、索引完全一致。也就是说 4 个 `.sql` 文件足以复刻出当前结构，不依赖任何手工操作。

**注意**：这只证明「结构」可复刻。数据不复刻——`vehicle_option` 是空表不需要种子数据，
其余表里的行都是测试数据，clone 下来是干净的空库，这是预期行为。

---

## 5. 改 SQL 时注意

1. **改完必须 `npm --prefix apps/api run build`。**
   运行时读的是 `dist/` 里被 nest-cli assets 拷过去的那份 `.sql`，不 build 等于没改。
2. **不要写 `DO $$ ... $$` 块，也不要在注释或字符串里写分号。**
   `applySchema()` 是最朴素的 `readFileSync(...).split(';')` 按分号切，
   再逐条 `query()`。函数体、`$$` 块、字符串里的分号都会把它切坏。
3. 新表要么放进已有的某个 `.sql`（按依赖顺序），要么在 `onModuleInit()` 里
   显式 `applySchema('新文件.sql')` 并排在正确的依赖位置——**别指望自动发现文件**。
4. 改列名要谨慎：`dispatch_offer.wave` 就是历史列名，含义变了但名字没改，
   改名的成本（迁移脚本 + 代码同步）比留着注释高，所以留着。

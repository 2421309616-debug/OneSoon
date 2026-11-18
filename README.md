# 万顺 OneSoon

一个打车产品的单仓仓库：乘客端、司机端、管理后台、后端 API，外加一个独立的**派单算法库**。

派单（一笔订单为什么派给这个司机）的完整设计见
[`docs/design/2026-11-15-dispatch-strategy.md`](docs/design/2026-11-15-dispatch-strategy.md)。

---

## 目录

| 路径 | 是什么 | 技术栈 | 端口 |
|---|---|---|---|
| `apps/api` | 后端 API，乘客端/司机端/管理后台共用 | NestJS + pg | 3000 |
| `apps/passenger` | 乘客端 H5 | Vue 3 + uni-app | 5173 |
| `apps/driver` | 司机端 H5（抢单版） | Vue 3 + uni-app | 5174 |
| `apps/admin` | 管理后台，纯静态 HTML，直接双击打开 | HTML + JS | — |
| `apps/server` | **派单算法库**（纯函数，不连数据库），以 `@onesoon/dispatch` 被 `apps/api` 引用 | TypeScript | — |
| `docs` | 设计文档、ADR | Markdown | — |

`node_modules` 不是 workspace：**每个 app 各自 `npm install`**，仓库根目录没有 `package.json`。

---

## 本地跑起来

前置：Node.js 20+、Docker Desktop（Windows 上需要 WSL 2.x，`wsl --version` 能正常返回）。

按顺序执行，**顺序不能换**（`apps/api` 依赖 `apps/server` 编译出的 `dist`）：

```bash
# 1. 环境变量（仓库根，两个 .env 都由 .env.example 复制）
cp .env.example .env

# 2. 起数据库（postgres:16，读根目录 .env 里的 POSTGRES_*）
docker compose up -d
#    等 healthy：docker ps 看到 onesoon-postgres 状态是 (healthy)

# 3. 派单算法库：装依赖并编译（api 引用的是它的 dist）
npm --prefix apps/server install
npm --prefix apps/server run build

# 4. 后端 API：装依赖并启动，首次启动会自动建表
npm --prefix apps/api install
npm --prefix apps/api start

# 5. 乘客端（另开终端）
cp apps/passenger/.env.example apps/passenger/.env   # 填高德 key，不填只是地图空白
npm --prefix apps/passenger install
npm --prefix apps/passenger run dev:h5

# 6. 司机端（另开终端）
cp apps/driver/.env.example apps/driver/.env
npm --prefix apps/driver install
npm --prefix apps/driver run dev:h5

# 7. 管理后台：浏览器直接打开 apps/admin/login.html
#    账号 chimera / 密码 666666
```

启动成功的标志：API 终端打印 `[DatabaseService] Connected to database onesoon`。

前端用 `http://localhost:5173`（乘客端）/ `http://localhost:5174`（司机端）打开。
不要写 `127.0.0.1`——vite 默认只监听 `localhost` 解析出来的 `::1`，用 IPv4 地址会连不上。
两端的前端代码里 `API_ROOT` 硬编码成 `http://127.0.0.1:3000`，API 两种写法都能连。

### 登录验证码在哪

乘客端/司机端用「手机号 + 验证码」登录，**验证码不发给手机，直接打印在 API 的终端里**，
形如 `login code for 13800000000: 123456`，5 分钟内有效、一码一用。
验证码存在内存里，**重启 API 后之前发的码全部失效**，重新点「获取验证码」即可。

---

## 数据库

没有迁移框架。`apps/api` 启动时按固定顺序把 `apps/api/src/database/*.sql` 幂等跑一遍：

```
passenger.sql → driver.sql → vehicle.sql → dispatch.sql
```

- 顺序有意义：`dispatch.sql` 要给 `driver` 加列、给 `trip_order` 加外键，必须排在这两张表之后。
- 所有语句都是 `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP ... IF EXISTS`，
  重复执行安全，**不需要手动建表或跑迁移**。
- 库名必须正好是 `onesoon`，否则 API 直接启动失败并报
  `Expected database onesoon, connected to X`。这是刻意的保护，防止连错库。
- 改完 `.sql` 一定要 `npm --prefix apps/api run build`：运行时读的是 `dist/` 里的副本，
  nest-cli 的 assets 配置负责拷贝，不 build 等于没改。

表结构、每张表为什么这么建、怎么从零验证复刻一致，见
[`apps/api/src/database/README.md`](apps/api/src/database/README.md)。

---

## 测试

```bash
npm --prefix apps/server test        # 派单算法单测（52 个用例，不需要数据库）
npm --prefix apps/server run test:watch
npm --prefix apps/api test           # 后端单测
npm --prefix apps/passenger run type-check   # vue-tsc
npm --prefix apps/driver run type-check
```

算法库的测试是纯函数的，几秒跑完，是最快的回归手段。

---

## Windows 上踩过的坑

- **vite 监听崩溃**：Windows 下 watcher 碰到被占用的文件会 `EBUSY` 崩掉，
  `vite.config.ts` 里已经加了 `server.watch.ignored`，别删。
- **Docker Desktop 起不来**：报
  `engine linux/wsl failed to start: checking preconditions: WSL update required`
  说明 WSL 版本太旧，装 GitHub 上的 WSL MSI（`wsl.<version>.x64.msi`）后重启 Docker Desktop，不用重启系统。
- **代理**：`curl` / `Invoke-WebRequest` 不会自动走 Windows 系统代理，需要显式 `--proxy`。

---

## 还没做的

- 订单状态机只有 `waiting / accepted / cancelled` 三个状态，
  「前往上车点 / 等待上车 / 行程中 / 结算 / 已完成」未落地，见策略文档 §5.4、§9.4。
- 接驾距离目前是**直线距离 × 1.3**，还没接高德真实路面距离，见策略文档 §8。
- 服务分第一期固定 4.80（还没有评价体系），只在「一样快」时做排序 tiebreak。

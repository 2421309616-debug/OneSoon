# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

前端是 Vue 3 + uni-app，代码在 `apps/passenger`。先做移动端 H5，同一套页面以后编译成小程序。后端是 NestJS，运行在 Node.js 上，乘客端、司机端、管理端共用这一套。见 `docs/adr/0001-nestjs-for-backend.md`。本地数据库是 Docker 里的 PostgreSQL，见 `docs/adr/0002-postgres-in-docker.md`。

## Users

乘客用手机打开万顺，确认上车点、填写目的地，并进入打车。当前只做用户端。

## Product Purpose

万顺（OneSoon）是打车产品的用户端。这一阶段要能看到首页结构：地图预留区、上车点、目的地、小应用入口，以及「首页 / 我的」两个导航。

## Capabilities and Constraints

- 已做页面：登录、首页、我的。打开乘客端先填写手机号和验证码。本地验证码打印在后端终端，不显示在页面上。
- 地图区域先空着，保留固定展示位置。
- 派单后的司机位置、距离和预计到达时间先不做。
- 小应用从 `apps/passenger/src/mini-apps.ts` 挂入。当前没有具体应用。
- 底部导航只有首页、我的。
- 底色为白，logo 和强调色为红 `#D0121A`。

## Brand Commitments

- 中文名：万顺
- 英文名：OneSoon
- 白底，红色用于 logo 和按钮

## Evidence on Hand

布局参照滴滴出行首页，并按上面的约束精简。没有单独的图形 logo 文件。

## Product Principles

- 先把用户端这一屏做完整，再加地图和派单。
- 小应用从注册表挂入，不写死在页面结构里。
- 页面按手机 H5 来写，并保持能编译到小程序。

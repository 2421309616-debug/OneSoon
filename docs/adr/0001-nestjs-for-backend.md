---
status: accepted
---

# 后端使用 NestJS

万顺的乘客端、司机端、管理端共用一个后端。前端已经是 Vue 3 和 TypeScript。后端确定用 NestJS，运行在 Node.js 上。接口和页面用同一种语言；账号、订单按模块往上加；登录后按乘客、司机、管理员放行。

FastAPI 和 Django 也能做多端接口，但它们是 Python。FastAPI 不规定数据库、登录和模块怎么拆。Django 主要面向自己渲染网页，给三个前端提供 JSON 还要再加 Django REST framework，派单推送还要 Channels。本地 PostgreSQL 用 Docker 运行，见 `docs/adr/0002-postgres-in-docker.md`。表、NestJS 和第一个接口等有功能要存数据时再加，不提前搭空项目。

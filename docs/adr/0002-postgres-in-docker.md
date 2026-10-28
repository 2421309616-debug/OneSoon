---
status: accepted
---

# 本地数据库用 Docker 里的 PostgreSQL

本地开发的数据库是 Docker 里的 PostgreSQL 16。启动方式在 `docker-compose.yml`，连接信息在 `.env`，样例在 `.env.example`。数据存在 Docker volume `onesoon_postgres_data`。乘客端、司机端、管理端不连接数据库。表和 NestJS 等第一个要存数据的功能再加。

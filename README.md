# 传智餐厅助手（chuanzi-restaurant-assistant）

一个基于原生 HTML/CSS/JS + Java 17 HttpServer + MySQL 8 的餐厅点餐与商家管理系统，补齐了商家菜品查询/删除与顾客订单取消等管理能力。

## 原始需求

> 做一个java项目，要求：《传智餐厅助手》设有商家和顾客两类用户角色。商家登录后可进行菜品管理、订单管理、信息管理与登录管理四项主要操作。其中菜品管理包含查询、新增及编辑功能；订单管理支持查询与修改；信息管理则涵盖基本信息维护与密码修改。顾客端提供注册、点餐、订单管理、信息管理及登录管理等功能。其中点餐模块进一步包括菜品浏览、购物车添加与移除、订单提交等具体操作。用原生做就行，包括GUI界面，框架类的技术不要有，包含MySQL数据库

## 功能覆盖

- 顾客注册、登录、退出，Session Cookie 认证
- 顾客菜品浏览、购物车（localStorage）、提交订单、查看我的订单、取消自己的 NEW 订单
- 商家菜品查询（关键字 + 状态）/新增/编辑/删除/上下架
- 商家订单查询与状态修改（NEW/CONFIRMED/CANCELLED/DONE），顾客可取消自己的订单
- 角色鉴权（403）与未登录拦截（401）
- 账户基础信息维护（昵称/手机号）
- 修改密码（校验旧密码）

## 默认账号

- 商家：`merchant_admin`
- 密码：`Merchant@123`
- 顾客：`customer_test`
- 密码：`Customer@123`

说明：以上是演示环境的登录口令；数据库 `users.password_hash` 中保存的是加盐后的 SHA-256 哈希，不是明文密码。

## 环境要求

- Node.js 20+
- pnpm 10+
- JDK 17+
- Maven 3.9+
- Docker（用于 MySQL 与集成测试）

## 最简启动

如果你只是想最快跑起来，并且确保 README 里的默认账号一定可登录，直接执行：

```bash
pnpm install
pnpm demo:fresh
```

说明：

- `pnpm demo:fresh` 会先执行 `docker compose down -v` 清空旧数据卷，再重新构建并启动应用与 MySQL。
- 这一步会重建数据库，所以最适合演示环境、验收环境和“默认账号登录失败”的排查场景。
- 启动成功后访问 `http://127.0.0.1:8080/login.html`，使用 README 中的默认账号登录。

## 本地快速开始（推荐）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 MySQL（3307）

```bash
docker compose up -d mysql
```

### 3. 初始化数据库

```bash
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot < sql/schema.sql
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot < sql/seed.sql
```

### 4. 启动应用

```bash
pnpm dev
```

访问：[http://127.0.0.1:8080/login.html](http://127.0.0.1:8080/login.html)

提示：

- 如果你之前已经启动过 MySQL 容器，旧数据卷中的用户数据不会被 `docker-entrypoint-initdb.d` 自动覆盖，这时 README 默认账号可能和你本地数据库里的历史数据不一致。
- 遇到这种情况，优先执行 `pnpm demo:fresh`，而不是只重复执行 `docker compose up -d`。

## 一键容器运行（非 Alpine）

```bash
docker compose up -d --build
```

- App: `http://127.0.0.1:8080`
- MySQL: `127.0.0.1:3307`

停止并清理：

```bash
docker compose down -v
```

如果本机端口冲突，可临时覆盖端口后再启动：

```bash
APP_HOST_PORT=18080 MYSQL_HOST_PORT=13307 docker compose up -d --build
```

如果你已经遇到中文文案乱码，可执行一次修复脚本：

```bash
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot < sql/fix-encoding.sql
```

## 常用命令

```bash
pnpm lint
pnpm test
pnpm e2e
pnpm build
pnpm dev
pnpm demo:fresh
docker compose up -d --build
docker compose down -v
```

说明：

- `pnpm test` 会自动完成 DB 初始化、服务启动、Playwright 全链路 E2E（桌面+移动双视口）以及 `cart` 逻辑单测。
- E2E 分支映射见 `docs/e2e-coverage-matrix.md`。

## 接口总览

| Method | Path                      | 说明             |
| ------ | ------------------------- | ---------------- |
| POST   | `/api/auth/register`      | 顾客注册         |
| POST   | `/api/auth/login`         | 登录             |
| POST   | `/api/auth/logout`        | 退出             |
| GET    | `/api/account/me`         | 当前用户         |
| PUT    | `/api/account/me`         | 更新资料         |
| PUT    | `/api/account/password`   | 修改密码         |
| GET    | `/api/dishes`             | 菜品查询         |
| POST   | `/api/dishes`             | 商家新增菜品     |
| PUT    | `/api/dishes/{id}`        | 商家编辑菜品     |
| DELETE | `/api/dishes/{id}`        | 商家删除菜品     |
| GET    | `/api/orders`             | 订单查询         |
| POST   | `/api/orders`             | 顾客提交订单     |
| PUT    | `/api/orders/{id}/status` | 商家改状态/顾客取消订单 |
| GET    | `/api/health`             | 健康检查         |

统一响应结构：

```json
{
	"code": 0,
	"message": "ok",
	"data": {}
}
```

错误码约定：

- `40000` 参数错误
- `40100` 未登录/会话过期
- `40300` 无权限
- `40400` 资源不存在
- `40900` 业务冲突（如下架菜品下单）
- `50000` 服务异常

## 项目结构

```text
backend/                 Java 后端（HttpServer + JDBC）
web/                     静态前端页面与 JS
sql/                     建表和种子数据
scripts/                 lint/test/build/dev 脚本
docs/                    验收说明
Dockerfile               应用镜像（非 Alpine）
docker-compose.yml       应用 + MySQL 组合编排
```

## 代码架构

### 后端（Java 17 + HttpServer）

- 启动入口：`RestaurantAssistantApplication` 创建 `HttpServer`，挂载 `StaticFileHandler`、`ApiHandler`、`RootHandler`。
- 分层组织：
  - `handler`：HTTP 路由分发、方法校验、请求读取与响应写回。
  - `service`：认证、账户、菜品、订单等业务规则与状态流转校验。
  - `repository`：基于 JDBC 的数据访问，全部使用 `PreparedStatement`。
  - `infra/util`：统一 JSON 序列化、响应模型、异常模型、参数校验、密码哈希。
- 配置管理：`AppConfig` 统一读取端口、数据库、会话 TTL、密码盐等配置。
- 事务边界：下单流程在单事务中完成订单头、明细、总额写入，失败即回滚。

### 前端（静态页面 + Vanilla JS）

- 页面按角色拆分：`customer/*`、`merchant/*` 与公共页（登录、注册、账户）。
- 公共模块：
  - `api.js`：统一请求封装、错误码处理、401 重定向策略。
  - `auth.js`：页面鉴权守卫与角色校验。
  - `cart.js`：购物车本地持久化、金额计算、下单数据转换。
- 页面脚本按场景分离：每个页面一个主脚本，避免跨页面耦合。
- E2E 稳定选择器：页面和关键动态节点提供 `data-testid` 作为测试契约。

### 测试与交付链路

- E2E：Playwright（Chromium）双项目 `desktop-chromium` / `mobile-chromium`。
- 覆盖矩阵：`docs/e2e-coverage-matrix.md` 映射“页面/分支 -> 用例”。
- `pnpm test` 编排：初始化 DB -> 启动应用 -> 执行 E2E -> 执行 `cart` 单测 -> 清理环境。

## 技术细节

- 数据模型：`users`、`sessions`、`dishes`、`orders`、`order_items`，金额字段统一 `price_cents`/`total_cents`（整数分）。
- 认证机制：登录后下发 `session_token` Cookie；服务端 `sessions` 表记录 token 与过期时间。
- 权限模型：
  - `CUSTOMER`：浏览可售菜品、提交订单、查看个人订单。
  - `MERCHANT`：管理菜品、查看并更新订单状态。
- 状态流转：支持 `NEW -> CONFIRMED/CANCELLED`、`CONFIRMED -> DONE`，非法流转返回业务错误。
- 统一返回体：`{ code, message, data }`，业务错误码覆盖 `400/401/403/404/409/500` 语义。
- 健壮性处理：
  - 非法 JSON、字段缺失、类型错误均返回参数错误。
  - 前端对本地损坏购物车 JSON 做兜底恢复（回退为空购物车）。
- 容器化（非 Alpine）：
  - 构建镜像：`maven:3.9-eclipse-temurin-17`
  - 运行镜像：`eclipse-temurin:17-jre-jammy`
  - 数据库镜像：`mysql:8.0`

## 假设与默认值

- Session 过期时间：24 小时（`SESSION_TTL_HOURS`）
- 密码哈希：`SHA-256(rawPassword|salt)`
- 密码盐默认：`chuanzi-default-salt`
- 手机号仅做基础格式校验（11 位以 1 开头）
- 时间以数据库本地时间写入并展示

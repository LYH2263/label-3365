# 传智餐厅助手 MVP 规划
*chuanzi-restaurant-assistant*

## 项目概述

**描述**: 一个基于原生 HTML/CSS/JS + Java（不使用框架，JDK 自带 HttpServer）+ MySQL 的轻量餐厅点餐与商家管理系统。包含商家与顾客两类角色：顾客可注册登录、浏览菜品、购物车下单、查看/取消订单与维护账户信息；商家可登录后进行菜品新增/编辑/查询/删除、订单查询与状态修改、账户信息与密码维护。

**目标用户**:
- 顾客：需要在线浏览菜品、加入购物车并提交订单、查看/取消订单、维护个人信息
- 商家：需要维护菜品信息与上下架/删除、查看并处理订单、维护账号信息与密码

## 原始需求

> 做一个java项目，要求：《传智餐厅助手》设有商家和顾客两类用户角色。商家登录后可进行菜品管理、订单管理、信息管理与登录管理四项主要操作。其中菜品管理包含查询、新增及编辑功能；订单管理支持查询与修改；信息管理则涵盖基本信息维护与密码修改。顾客端提供注册、点餐、订单管理、信息管理及登录管理等功能。其中点餐模块进一步包括菜品浏览、购物车添加与移除、订单提交等具体操作。用原生做就行，包括GUI界面，框架类的技术不要有，包含MySQL数据库

## 评分信息

| 维度 | 分值 |
|------|------|
| 等级 | B |
| 总分 | 3.59 |
| 类型权重 | 3.25 |
| 加权总分 | 11.67 |
| 清晰度 | 4 |
| 复杂度 | 3.4 |
| 验证难度 | 1.4 |

## 技术栈

- **前端**: HTML + CSS + Vanilla JavaScript（Fetch API，本地 localStorage 保存购物车）
- **后端**: Java 17（JDK 内置 com.sun.net.httpserver.HttpServer，自写路由与 JSON 解析/序列化，JDBC 直连 MySQL）
- **数据库**: MySQL 8.0（InnoDB，utf8mb4）
- **选型理由**: 满足“原生实现、无框架”的约束；前端用静态页面+JS 调用后端接口；后端用 JDK 自带 HttpServer 与 JDBC 避免 Spring 等框架；MySQL 作为持久化存储，Session 令牌存库以便重启后仍可用。

## 核心功能

### 认证与角色访问控制 (P0)

- [ ] 顾客注册（用户名/密码/手机号/昵称）
- [ ] 登录/退出（基于 Session Token 的 Cookie 认证）
- [ ] 基于角色的页面与接口访问控制（merchant/customer）

### 顾客点餐与订单 (P0)

- [ ] 菜品浏览（仅展示可售菜品）
- [ ] 购物车添加/移除/修改数量（前端 localStorage）
- [ ] 提交订单（生成订单与订单明细，计算总价）
- [ ] 订单列表查看（我的订单与状态）
- [ ] 订单取消（顾客仅可取消自己的 NEW 订单）

### 商家菜品与订单管理 (P0)

- [ ] 菜品查询（支持关键字与上下架状态筛选）
- [ ] 菜品新增
- [ ] 菜品编辑（名称/价格/描述/上下架）
- [ ] 菜品删除（未被历史订单引用时可删除）
- [ ] 订单查询与状态修改（例如 NEW/CONFIRMED/CANCELLED/DONE）

### 账户信息管理 (P1)

- [ ] 查看/修改基础信息（昵称、手机号）
- [ ] 修改密码（校验旧密码）

## 页面结构

| 路由 | 页面 | 描述 |
|------|------|------|
| `/login.html` | 登录 | 商家/顾客统一登录入口，根据角色跳转到对应页面。 |
| `/register.html` | 顾客注册 | 仅顾客注册入口，注册成功后跳转登录或自动登录。 |
| `/customer/menu.html` | 顾客-点餐（菜品与购物车） | 展示可售菜品列表，支持加入购物车、移除、修改数量，并提交订单。 |
| `/customer/orders.html` | 顾客-我的订单 | 查看当前账号的订单列表与订单明细，并可取消自己的未处理订单。 |
| `/merchant/dishes.html` | 商家-菜品管理 | 商家对菜品进行查询、新增、编辑、删除及上下架。 |
| `/merchant/orders.html` | 商家-订单管理 | 商家查询订单并修改订单状态。 |
| `/account.html` | 账户信息 | 顾客/商家通用：查看与修改基础信息，修改密码，退出登录。 |

## 数据模型

### User

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| role | VARCHAR(16) | 角色：CUSTOMER 或 MERCHANT |
| username | VARCHAR(64) | 登录用户名，唯一 |
| password_hash | VARCHAR(255) | 密码哈希（例如 SHA-256 + salt，salt 可内置或单独字段） |
| display_name | VARCHAR(64) | 昵称/显示名 |
| phone | VARCHAR(32) | 手机号（可为空） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### Dish

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| name | VARCHAR(128) | 菜品名称 |
| price_cents | INT | 价格（分），避免浮点误差 |
| description | VARCHAR(512) | 菜品描述 |
| is_available | TINYINT | 是否可售/上架（1 可售，0 下架） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### Order

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| user_id | BIGINT | 下单顾客ID（关联 User.id） |
| total_cents | INT | 订单总金额（分） |
| status | VARCHAR(16) | 订单状态：NEW/CONFIRMED/CANCELLED/DONE |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### OrderItem

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| order_id | BIGINT | 所属订单ID（关联 Order.id） |
| dish_id | BIGINT | 菜品ID（关联 Dish.id） |
| dish_name_snapshot | VARCHAR(128) | 下单时菜品名快照，避免后续改名影响历史订单展示 |
| price_cents_snapshot | INT | 下单时单价快照（分） |
| quantity | INT | 数量 |

### Session

| 字段 | 类型 | 说明 |
|------|------|------|
| token | VARCHAR(64) | 会话令牌（随机生成，主键） |
| user_id | BIGINT | 会话所属用户ID |
| expires_at | DATETIME | 过期时间 |
| created_at | DATETIME | 创建时间 |

## API 端点

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | `none` | 顾客注册（创建 CUSTOMER 用户）。请求：username/password/displayName/phone。返回：成功或错误信息。 |
| `POST` | `/api/auth/login` | `none` | 登录（商家/顾客）。请求：username/password。返回：role 与基础信息，并通过 Set-Cookie 写入 session_token。 |
| `POST` | `/api/auth/logout` | `required` | 退出登录（删除当前 session）。 |
| `GET` | `/api/account/me` | `required` | 获取当前登录用户信息（id/role/username/displayName/phone）。 |
| `PUT` | `/api/account/me` | `required` | 更新基础信息（displayName/phone）。 |
| `PUT` | `/api/account/password` | `required` | 修改密码（oldPassword/newPassword）。 |
| `GET` | `/api/dishes` | `required` | 查询菜品。顾客默认仅返回 is_available=1；商家可传 scope=all 返回全部，并支持 keyword / isAvailable 查询参数。 |
| `POST` | `/api/dishes` | `required` | 商家新增菜品（name/priceCents/description/isAvailable）。 |
| `PUT` | `/api/dishes/{id}` | `required` | 商家编辑菜品（name/priceCents/description/isAvailable）。 |
| `DELETE` | `/api/dishes/{id}` | `required` | 商家删除未被历史订单引用的菜品；若已有订单引用则返回冲突并提示改为下架。 |
| `GET` | `/api/orders` | `required` | 查询订单列表。顾客返回自己的订单；商家返回全量订单（可按 status 可选查询参数过滤）。 |
| `POST` | `/api/orders` | `required` | 顾客提交订单。请求：items[{dishId,quantity}]（由前端购物车组织）。服务端校验菜品可售并生成订单与明细。 |
| `PUT` | `/api/orders/{id}/status` | `required` | 商家修改订单状态；顾客仅可将自己的 NEW 订单取消为 CANCELLED。请求：status（CONFIRMED/CANCELLED/DONE）。 |

## 验收标准

### AC-CORE-001 (core)

- **Given**: 顾客已注册且菜品存在并为可售
- **When**: 顾客登录后在点餐页将多个菜品加入购物车并提交订单
- **Then**: 系统创建一笔订单与对应明细，订单总价等于明细单价快照*数量之和，顾客在“我的订单”中可看到该订单且状态为 NEW

### AC-CORE-002 (core)

- **Given**: 商家已登录
- **When**: 商家新增一个菜品并设置为可售，然后在菜品管理中查询
- **Then**: 新增菜品出现在商家菜品列表中，顾客在点餐页也能通过菜品浏览接口看到该菜品

### AC-EDGE-001 (edge)

- **Given**: 顾客购物车中包含某个菜品且该菜品被商家下架
- **When**: 顾客提交订单
- **Then**: 接口返回失败并明确指出不可售菜品，订单不落库，前端提示用户移除或替换该菜品

### AC-ERROR-001 (error)

- **Given**: 用户未登录或 Session 已过期
- **When**: 访问需要登录的接口（例如 GET /api/orders 或 PUT /api/dishes/1）
- **Then**: 返回 401，前端跳转到登录页并提示需要重新登录

### AC-USABILITY-001 (usability)

- **Given**: 顾客在点餐页进行购物车操作
- **When**: 顾客增加/减少数量或移除菜品
- **Then**: 购物车展示与总价在 1 秒内更新，且刷新页面后购物车仍能从 localStorage 恢复

### AC-CORE-003 (core)

- **Given**: 商家已登录且存在状态为 NEW 的订单
- **When**: 商家将订单状态修改为 CONFIRMED
- **Then**: 订单状态更新成功，商家订单列表与顾客“我的订单”中均能看到最新状态

### AC-CORE-004 (core)

- **Given**: 顾客已登录且存在状态为 NEW 的本人订单
- **When**: 顾客在“我的订单”页执行取消操作
- **Then**: 订单状态更新为 CANCELLED，顾客与商家查询到的订单状态保持一致

### AC-EDGE-002 (edge)

- **Given**: 商家已登录，且存在一个未产生历史订单的菜品与一个已产生历史订单的菜品
- **When**: 商家在菜品管理页按关键字查询并分别尝试删除
- **Then**: 未引用菜品删除成功且列表不再显示；已引用菜品删除失败并提示改为下架

### AC-ERROR-002 (error)

- **Given**: 顾客已登录
- **When**: 尝试调用商家权限接口（例如 POST /api/dishes）
- **Then**: 返回 403，且不产生任何数据变更

## 不在 MVP 范围内

- 在线支付、退款、发票能力
- 配送地址管理、配送员派单、到店/外卖复杂流程
- 优惠券、满减、会员积分
- 图片上传与 CDN、菜品图片管理
- 复杂报表与数据分析
- 第三方短信/邮件通知（避免付费外部 API）
- 多商家/多门店/多桌台支持

## 实现里程碑

### Phase 1 - 基础工程与认证闭环

- [ ] 创建 MySQL 表：users/dishes/orders/order_items/sessions，并编写初始化 SQL（含唯一索引与必要外键/索引）
- [ ] Java HttpServer 启动与静态资源托管（/login.html 等），实现最小路由分发与 JSON 解析/返回
- [ ] 实现注册/登录/退出与 Session Cookie 校验中间逻辑（按 token 查 sessions）
- [ ] 实现 /account.html 页面与 GET/PUT /api/account/me、PUT /api/account/password

**验收**: ['顾客可注册并登录成功，浏览器获得 session_token Cookie', '未登录访问 /api/account/me 返回 401', '已登录可查看并修改昵称/手机号，修改密码后旧密码不可再登录']

### Phase 2 - 顾客点餐与订单

- [ ] 实现菜品查询接口 GET /api/dishes（顾客仅返回可售）
- [ ] 实现顾客点餐页 /customer/menu.html（菜品列表、localStorage 购物车、提交订单）
- [ ] 实现提交订单 POST /api/orders（校验可售、写入 orders 与 order_items、计算总价）
- [ ] 实现顾客订单页 /customer/orders.html 与 GET /api/orders（仅本人订单）
- [ ] 实现顾客取消订单能力（顾客仅可取消自己的 NEW 订单）

**验收**: ['顾客可浏览菜品、购物车增删改数量并成功提交订单', '提交订单时若包含下架菜品则返回失败且不产生订单数据', '顾客订单页能看到订单与明细，金额与购物车提交一致', '顾客可取消自己的 NEW 订单，取消后状态同步为 CANCELLED']

### Phase 3 - 商家菜品/订单管理

- [ ] 实现商家菜品管理页 /merchant/dishes.html：查询全部菜品（scope=all，支持关键字/状态筛选）、新增 POST /api/dishes、编辑 PUT /api/dishes/{id}、删除 DELETE /api/dishes/{id}
- [ ] 实现商家订单管理页 /merchant/orders.html：查询全量订单 GET /api/orders、修改状态 PUT /api/orders/{id}/status
- [ ] 实现角色鉴权：仅 MERCHANT 可调用菜品新增/编辑/删除；仅 CUSTOMER 可提交订单与取消自己的订单
- [ ] 基础可用性打磨：前端错误提示、表单校验、接口返回结构统一（code/message/data）

**验收**: ['商家可按关键字/状态查询、新增、编辑、删除/上下架菜品，顾客端菜品列表实时反映上下架状态（以接口结果为准）', '商家可将订单从 NEW 改为 CONFIRMED/DONE，顾客订单列表可见状态变化', '顾客调用商家接口返回 403，商家调用提交订单接口返回 403']

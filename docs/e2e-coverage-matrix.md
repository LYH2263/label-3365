# E2E 覆盖矩阵（Playwright 全链路）

## 说明

- 执行入口：`pnpm test`（由 `scripts/test.sh` 启动 DB + 应用 + Playwright + cart 单测）
- 浏览器矩阵：`desktop-chromium`、`mobile-chromium`
- 用例目录：`e2e/specs/*.spec.js`

## 页面分支覆盖

| 分支ID | 页面/模块 | 场景 | 覆盖用例 |
|---|---|---|---|
| LG-01 | `/login.html` | `reason=expired` 提示 | `login.spec.js` LOGIN-01 |
| LG-02 | `/login.html` | 未登录停留登录页 | `login.spec.js` LOGIN-01 |
| LG-03 | `/login.html` | 登录失败提示 | `login.spec.js` LOGIN-01 |
| LG-04 | `/login.html` | 商家登录成功跳转 | `login.spec.js` LOGIN-02 |
| LG-05 | `/login.html` | 顾客登录成功跳转 | `login.spec.js` LOGIN-03 |
| LG-06 | `/login.html` | 已登录访问登录页自动跳转（商家/顾客） | `login.spec.js` LOGIN-02/03 |
| LG-07 | `api.js` | 登录页 `redirectOn401=false` 分支 | `login.spec.js` LOGIN-04 |
| RG-01 | `/register.html` | 密码不一致前端拦截 | `register.spec.js` REGISTER-01 |
| RG-02 | `/register.html` | 注册成功并跳转登录 | `register.spec.js` REGISTER-02 |
| RG-03 | `/register.html` | 重复用户名 409 | `register.spec.js` REGISTER-03 |
| RG-04 | `/register.html` | 用户名边界（短/非法/超长） | `register.spec.js` REGISTER-04 |
| RG-05 | `/register.html` | 密码边界（短/超长） | `register.spec.js` REGISTER-04 |
| RG-06 | `/register.html` | 手机号格式边界 | `register.spec.js` REGISTER-04 |
| AC-01 | `/account.html` | 未登录跳转登录 | `account.spec.js` ACCOUNT-01 |
| AC-02 | `/account.html` | 资料加载成功 | `account.spec.js` ACCOUNT-02 |
| AC-03 | `/account.html` | 资料更新成功 | `account.spec.js` ACCOUNT-02 |
| AC-04 | `/account.html` | 资料更新失败（手机号非法） | `account.spec.js` ACCOUNT-02 |
| AC-05 | `/account.html` | 密码不一致前端分支 | `account.spec.js` ACCOUNT-02 |
| AC-06 | `/account.html` | 新旧密码相同 | `account.spec.js` ACCOUNT-02 |
| AC-07 | `/account.html` | 旧密码错误 | `account.spec.js` ACCOUNT-02 |
| AC-08 | `/account.html` | 修改密码成功 + 旧密码失效 + 新密码生效 | `account.spec.js` ACCOUNT-02 |
| AC-09 | `/account.html` | 退出登录 | `account.spec.js` ACCOUNT-02 |
| CM-01 | `/customer/menu.html` | 未登录跳登录 | `customer-menu.spec.js` CUSTOMER-MENU-01 |
| CM-02 | `/customer/menu.html` | 购物车空态 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-03 | `/customer/menu.html` | 新增/重复加入数量递增 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-04 | `/customer/menu.html` | 数量增减/减到0移除 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-05 | `/customer/menu.html` | 手动移除 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-06 | `/customer/menu.html` | 空购物车提交提示 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-07 | `/customer/menu.html` | 正常提交成功跳订单页 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-08 | `/customer/menu.html` | 下架菜品提交冲突 409 | `customer-menu.spec.js` CUSTOMER-MENU-03 |
| CM-09 | `/customer/menu.html` | localStorage 刷新恢复 | `customer-menu.spec.js` CUSTOMER-MENU-02 |
| CM-10 | `/customer/menu.html` | localStorage 损坏 JSON 恢复空态 | `customer-menu.spec.js` CUSTOMER-MENU-04 |
| CO-01 | `/customer/orders.html` | 未登录跳登录 | `customer-orders.spec.js` CUSTOMER-ORDERS-01 |
| CO-02 | `/customer/orders.html` | 无订单空态 | `customer-orders.spec.js` CUSTOMER-ORDERS-02 |
| CO-03 | `/customer/orders.html` | 有订单渲染与明细 | `customer-orders.spec.js` CUSTOMER-ORDERS-02 |
| CO-04 | `/customer/orders.html` | 刷新按钮分支 | `customer-orders.spec.js` CUSTOMER-ORDERS-02 |
| CO-05 | `/customer/orders.html` | 顾客取消自己的 NEW 订单 | `customer-orders.spec.js` CUSTOMER-ORDERS-02 |
| MD-01 | `/merchant/dishes.html` | 未登录跳登录 | `merchant-dishes.spec.js` MERCHANT-DISHES-01 |
| MD-02 | `auth.js` | 顾客访问商家页 `alert+redirect+throw` | `merchant-dishes.spec.js` MERCHANT-DISHES-02 |
| MD-03 | `/merchant/dishes.html` | 菜品空态（mock） | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-04 | `/merchant/dishes.html` | 新增成功（上架/下架初值） | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-05 | `/merchant/dishes.html` | 新增失败（空名/价格<=0/描述超长） | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-06 | `/merchant/dishes.html` | 上下架切换成功 | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-07 | `/merchant/dishes.html` | 编辑取消分支（取消名称/取消价格） | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-08 | `/merchant/dishes.html` | 编辑成功 | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-09 | `/merchant/dishes.html` | 编辑失败（价格非法） | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-10 | `/merchant/dishes.html` | 关键字/状态查询分支 | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MD-11 | `/merchant/dishes.html` | 删除未引用菜品 | `merchant-dishes.spec.js` MERCHANT-DISHES-03 |
| MO-01 | `/merchant/orders.html` | 未登录跳登录 | `merchant-orders.spec.js` MERCHANT-ORDERS-01 |
| MO-02 | `/merchant/orders.html` | 顾客访问商家页角色拦截 | `merchant-orders.spec.js` MERCHANT-ORDERS-02 |
| MO-03 | `/merchant/orders.html` | 订单空态（mock） | `merchant-orders.spec.js` MERCHANT-ORDERS-03 |
| MO-04 | `/merchant/orders.html` | 状态筛选分支 | `merchant-orders.spec.js` MERCHANT-ORDERS-03 |
| MO-05 | `/merchant/orders.html` | NEW->CONFIRMED->DONE 成功流转 | `merchant-orders.spec.js` MERCHANT-ORDERS-03 |
| MO-06 | `/merchant/orders.html` | 非法流转失败 | `merchant-orders.spec.js` MERCHANT-ORDERS-03 |
| MO-07 | `/merchant/orders.html` | 刷新按钮分支 | `merchant-orders.spec.js` MERCHANT-ORDERS-03 |
| FM-01 | `api.js` | 登录页 401 不跳走 | `frontend-modules.spec.js` FRONTEND-MODULE-01 |
| FM-02 | `api.js` | 非 JSON 响应解析失败分支 | `frontend-modules.spec.js` FRONTEND-MODULE-02 |

## 接口边界覆盖

| 分支ID | 接口场景 | 覆盖用例 |
|---|---|---|
| API-01 | `OPTIONS /api/* -> 204` | `api-boundary.spec.js` API-01 |
| API-02 | 未知路由 404 | `api-boundary.spec.js` API-01 |
| API-03 | invalid JSON -> 400 | `api-boundary.spec.js` API-02 |
| API-04 | 数值类型错误 -> 400 | `api-boundary.spec.js` API-02 |
| API-05 | 重复注册 -> 409 | `api-boundary.spec.js` API-03 |
| API-06 | 顾客调用商家接口 -> 403 | `api-boundary.spec.js` API-03 |
| API-07 | 商家调用顾客下单接口 -> 403 | `api-boundary.spec.js` API-03 |
| API-08 | `items` 非数组 -> 400 | `api-boundary.spec.js` API-04 |
| API-09 | `items` 元素非对象 -> 400 | `api-boundary.spec.js` API-04 |
| API-10 | `dishId<=0`、`quantity` 边界 -> 400 | `api-boundary.spec.js` API-04 |
| API-11 | 不存在菜品下单 -> 409 | `api-boundary.spec.js` API-04 |
| API-12 | 更新不存在菜品 -> 404 | `api-boundary.spec.js` API-05 |
| API-13 | 下架菜品下单 -> 409 | `api-boundary.spec.js` API-05 |
| API-14 | `status` 非法枚举 -> 400 | `api-boundary.spec.js` API-05 |
| API-15 | 非法状态流转 -> 400 | `api-boundary.spec.js` API-05 |
| API-16 | 更新不存在订单 -> 404 | `api-boundary.spec.js` API-05 |
| API-17 | 登出后会话失效 -> 401 | `api-boundary.spec.js` API-05 |
| API-18 | 顾客越权确认订单 -> 403 | `api-boundary.spec.js` API-05 |
| API-19 | 删除已被历史订单引用的菜品 -> 409 | `api-boundary.spec.js` API-05 |

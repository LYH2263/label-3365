# 购物车与订单系统问题分析与解决方案

## 1. 价格不一致问题

### 问题分析

**前端购物车显示的总价：** ¥50.00（5000 分）

前端 `cart.js` 在 `addToCart` 函数中保存了价格快照：
```javascript
// web/assets/js/cart.js:32-46
export function addToCart(items, dish) {
  const next = [...items];
  const idx = next.findIndex((item) => item.dishId === dish.id);
  if (idx >= 0) {
    next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
  } else {
    next.push({
      dishId: dish.id,
      name: dish.name,
      priceCents: dish.priceCents,  // 存储加入购物车时的价格快照
      quantity: 1
    });
  }
  return next;
}
```

计算总价时使用的是快照价格：
```javascript
// web/assets/js/cart.js:61-63
export function totalCents(items) {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}
```

**后端实际创建订单时使用的总价：** ¥80.00（8000 分）

后端 `OrderService.java` 从数据库查询最新价格：
```java
// backend/src/main/java/com/chuanzi/app/service/OrderService.java:61-73
int total = 0;
List<OrderCreateItem> createItems = new ArrayList<>();
for (ItemRequest itemRequest : itemRequests) {
    Dish dish = dishMap.get(itemRequest.dishId());
    int lineTotal = dish.priceCents() * itemRequest.quantity();  // 使用数据库最新价格
    total += lineTotal;
    createItems.add(new OrderCreateItem(
        dish.id(),
        dish.name(),
        dish.priceCents(),  // 保存数据库最新价格作为订单快照
        itemRequest.quantity()
    ));
}
```

### 导致的问题

1. **用户体验差**：顾客在购物车页面看到 ¥50，点击提交后实际被扣款 ¥80，产生心理落差和不信任感。
2. **潜在投诉/纠纷**：顾客可能认为系统乱扣费，要求退款或投诉平台。
3. **法律风险**：价格公示与实际结算不一致，可能违反消费者权益保护相关法规。
4. **业务逻辑不一致**：前端显示的"确认订单"信息与后端实际创建的订单不符。

### 根本原因

前后端采用了**不同的定价策略**：
- 前端：使用**加入购物车时**的价格快照
- 后端：使用**提交订单时**的数据库最新价格

两者之间没有价格校验或价格变化通知机制。

### 解决方案

**方案 A：提交订单前价格校验 + 用户确认**

在提交订单时，后端返回实际价格，前端比较差异并提示用户确认。

**前端修改 - `cart.js`：**
```javascript
export function toOrderItemsWithPrice(items) {
  return items.map((item) => ({
    dishId: item.dishId,
    quantity: item.quantity,
    priceCents: item.priceCents  // 携带前端快照价格
  }));
}
```

**后端修改 - `OrderService.java`：**

新增价格校验方法，在创建订单前先进行价格确认：

```java
public Map<String, Object> previewOrder(AuthUser authUser, List<Map<String, Object>> itemsPayload) {
    if (!"CUSTOMER".equals(authUser.role())) {
        throw ApiException.forbidden("仅顾客可提交订单");
    }
    if (itemsPayload == null || itemsPayload.isEmpty()) {
        throw ApiException.badRequest("订单明细不能为空");
    }

    List<ItemRequest> itemRequests = new ArrayList<>();
    Set<Long> dishIds = new LinkedHashSet<>();
    for (Map<String, Object> itemMap : itemsPayload) {
        long dishId = toPositiveLong(itemMap.get("dishId"), "dishId");
        int quantity = ValidationUtil.requireQuantity(toInteger(itemMap.get("quantity"), "quantity"));
        Integer frontendPriceCents = itemMap.get("priceCents") != null 
            ? toInteger(itemMap.get("priceCents"), "priceCents") 
            : null;
        itemRequests.add(new ItemRequest(dishId, quantity, frontendPriceCents));
        dishIds.add(dishId);
    }

    Map<Long, Dish> dishMap = dishRepository.findByIds(dishIds);
    List<String> unavailableMessages = new ArrayList<>();
    List<Map<String, Object>> priceChanges = new ArrayList<>();
    int totalCents = 0;
    int frontendTotalCents = 0;

    for (ItemRequest itemRequest : itemRequests) {
        Dish dish = dishMap.get(itemRequest.dishId());
        if (dish == null) {
            unavailableMessages.add("菜品ID=" + itemRequest.dishId() + " 不存在");
            continue;
        }
        if (!dish.isAvailable()) {
            unavailableMessages.add("菜品「" + dish.name() + "」已下架");
            continue;
        }

        int lineTotal = dish.priceCents() * itemRequest.quantity();
        totalCents += lineTotal;

        if (itemRequest.frontendPriceCents() != null) {
            int frontendLineTotal = itemRequest.frontendPriceCents() * itemRequest.quantity();
            frontendTotalCents += frontendLineTotal;

            if (dish.priceCents() != itemRequest.frontendPriceCents()) {
                Map<String, Object> change = new LinkedHashMap<>();
                change.put("dishId", dish.id());
                change.put("name", dish.name());
                change.put("oldPriceCents", itemRequest.frontendPriceCents());
                change.put("newPriceCents", dish.priceCents());
                change.put("quantity", itemRequest.quantity());
                priceChanges.add(change);
            }
        }
    }

    if (!unavailableMessages.isEmpty()) {
        throw ApiException.conflict(String.join("；", unavailableMessages));
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("totalCents", totalCents);
    result.put("frontendTotalCents", frontendTotalCents);
    result.put("hasPriceChange", !priceChanges.isEmpty());
    result.put("priceChanges", priceChanges);
    return result;
}

private record ItemRequest(long dishId, int quantity, Integer frontendPriceCents) {
}
```

**前端提交订单流程：**
1. 调用 `previewOrder` 获取价格预览
2. 如果有价格变化，弹窗提示用户："菜品「宫保鸡丁」价格已从 ¥50.00 变为 ¥80.00，是否继续？"
3. 用户确认后再调用 `createOrder`

**方案 B：以购物车价格为准（锁价机制）**

在购物车中加入价格有效期，后端创建订单时校验价格是否在有效期内。

**优缺点对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 方案 A（校验+确认） | 用户知情同意，避免纠纷；商家可灵活调价 | 增加一次 API 调用；用户多一步确认 |
| 方案 B（锁价） | 用户体验流畅，所见即所得 | 需要管理价格有效期；商家调价受限 |

**推荐采用方案 A**，因为它兼顾了商家调价的灵活性和用户的知情权。

---

## 2. 并发安全问题

### 问题分析

**线程 A 的订单能否成功创建？**

**能。** 让我们看一下代码执行流程：

```java
// backend/src/main/java/com/chuanzi/app/service/OrderService.java:47-75
// 第 3 步：查询菜品
Map<Long, Dish> dishMap = dishRepository.findByIds(dishIds);
// 此时 dish.isAvailable() = true

// 第 4 步：检查可用性
for (Long dishId : dishIds) {
    Dish dish = dishMap.get(dishId);
    if (dish == null) {
        unavailableMessages.add("菜品ID=" + dishId + " 不存在");
    } else if (!dish.isAvailable()) {  // 检查通过
        unavailableMessages.add("菜品「" + dish.name() + "」已下架");
    }
}
// ==== 线程 B 在此期间执行：UPDATE dishes SET is_available = 0 WHERE id = ? ====

// 第 5 步：计算总价（使用内存中缓存的 dish 对象）
int total = 0;
for (ItemRequest itemRequest : itemRequests) {
    Dish dish = dishMap.get(itemRequest.dishId());  // 内存缓存，isAvailable 仍为 true
    int lineTotal = dish.priceCents() * itemRequest.quantity();
    total += lineTotal;
    createItems.add(new OrderCreateItem(...));
}

// 第 6 步：创建订单
long orderId = orderRepository.createOrderWithItems(authUser.id(), createItems, total);
```

**违反的业务规则：**
- 已下架的菜品不应该被创建订单
- 订单创建时应确保所有菜品仍然可用

### 根本原因

**检查-使用（Check-Then-Act）竞态条件：**

第 3 步到第 6 步之间存在时间窗口，在此期间：
1. 菜品数据被查询到内存（第 3 步）
2. 可用性检查基于内存中的数据（第 4 步）
3. 其他线程（商家）可以修改数据库中的数据
4. 订单创建时没有再次校验（第 5-6 步）

此外，`dishRepository.findByIds` 和 `orderRepository.createOrderWithItems` 使用的是**不同的数据库连接**（每次调用 `database.getConnection()` 获取新连接），不在同一个事务中，无法通过数据库事务隔离来防止。

### 解决方案

**方案 A：SQL 层面的悲观锁（SELECT ... FOR UPDATE）**

在查询菜品时加行锁，确保在订单创建完成前其他事务无法修改菜品数据。

**修改 `DishRepository.java`：**

```java
public Map<Long, Dish> findByIdsForUpdate(Set<Long> ids, Connection conn) {
    if (ids.isEmpty()) {
        return Map.of();
    }
    StringBuilder placeholders = new StringBuilder();
    for (int i = 0; i < ids.size(); i++) {
        if (i > 0) {
            placeholders.append(",");
        }
        placeholders.append("?");
    }
    // 加 FOR UPDATE 行锁
    String sql = "SELECT id, name, price_cents, description, is_available, created_at, updated_at " +
                 "FROM dishes WHERE id IN (" + placeholders + ") FOR UPDATE";

    try (PreparedStatement ps = conn.prepareStatement(sql)) {
        int index = 1;
        for (Long id : ids) {
            ps.setLong(index++, id);
        }
        try (ResultSet rs = ps.executeQuery()) {
            Map<Long, Dish> map = new HashMap<>();
            while (rs.next()) {
                Dish dish = mapDish(rs);
                map.put(dish.id(), dish);
            }
            return map;
        }
    } catch (SQLException e) {
        throw new RuntimeException("批量查询菜品失败", e);
    }
}
```

**修改 `OrderService.java` - 使用共享连接和事务：**

```java
public Map<String, Object> createOrder(AuthUser authUser, List<Map<String, Object>> itemsPayload) {
    if (!"CUSTOMER".equals(authUser.role())) {
        throw ApiException.forbidden("仅顾客可提交订单");
    }
    if (itemsPayload == null || itemsPayload.isEmpty()) {
        throw ApiException.badRequest("订单明细不能为空");
    }

    List<ItemRequest> itemRequests = new ArrayList<>();
    Set<Long> dishIds = new LinkedHashSet<>();
    for (Map<String, Object> itemMap : itemsPayload) {
        long dishId = toPositiveLong(itemMap.get("dishId"), "dishId");
        int quantity = ValidationUtil.requireQuantity(toInteger(itemMap.get("quantity"), "quantity"));
        itemRequests.add(new ItemRequest(dishId, quantity));
        dishIds.add(dishId);
    }

    // 在同一个事务中完成：锁定菜品 → 检查可用性 → 创建订单
    try (Connection conn = database.getConnection()) {
        conn.setAutoCommit(false);
        try {
            // 第 3 步：查询菜品并加行锁
            Map<Long, Dish> dishMap = dishRepository.findByIdsForUpdate(dishIds, conn);

            // 第 4 步：检查菜品是否存在和可用
            List<String> unavailableMessages = new ArrayList<>();
            for (Long dishId : dishIds) {
                Dish dish = dishMap.get(dishId);
                if (dish == null) {
                    unavailableMessages.add("菜品ID=" + dishId + " 不存在");
                } else if (!dish.isAvailable()) {
                    unavailableMessages.add("菜品「" + dish.name() + "」已下架");
                }
            }
            if (!unavailableMessages.isEmpty()) {
                conn.rollback();
                throw ApiException.conflict(String.join("；", unavailableMessages));
            }

            // 第 5 步：计算订单总价
            int total = 0;
            List<OrderCreateItem> createItems = new ArrayList<>();
            for (ItemRequest itemRequest : itemRequests) {
                Dish dish = dishMap.get(itemRequest.dishId());
                int lineTotal = dish.priceCents() * itemRequest.quantity();
                total += lineTotal;
                createItems.add(new OrderCreateItem(
                    dish.id(),
                    dish.name(),
                    dish.priceCents(),
                    itemRequest.quantity()
                ));
            }

            // 第 6 步：创建订单（使用同一连接）
            long orderId = orderRepository.createOrderWithItems(conn, authUser.id(), createItems, total);

            conn.commit();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orderId", orderId);
            result.put("totalCents", total);
            result.put("status", "NEW");
            return result;
        } catch (Exception e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
    } catch (SQLException e) {
        throw new RuntimeException("创建订单失败", e);
    }
}
```

**修改 `OrderRepository.java` - 支持外部传入连接：**

```java
public long createOrderWithItems(Connection conn, long userId, List<OrderCreateItem> items, int totalCents) throws SQLException {
    String orderSql = "INSERT INTO orders(user_id, total_cents, status, created_at, updated_at) VALUES (?, ?, 'NEW', ?, ?)";
    String itemSql = "INSERT INTO order_items(order_id, dish_id, dish_name_snapshot, price_cents_snapshot, quantity) VALUES (?, ?, ?, ?, ?)";
    LocalDateTime now = LocalDateTime.now();

    long orderId;
    try (PreparedStatement orderPs = conn.prepareStatement(orderSql, Statement.RETURN_GENERATED_KEYS)) {
        orderPs.setLong(1, userId);
        orderPs.setInt(2, totalCents);
        orderPs.setObject(3, now);
        orderPs.setObject(4, now);
        orderPs.executeUpdate();
        try (ResultSet rs = orderPs.getGeneratedKeys()) {
            if (!rs.next()) {
                throw new SQLException("创建订单失败，未返回主键");
            }
            orderId = rs.getLong(1);
        }
    }

    try (PreparedStatement itemPs = conn.prepareStatement(itemSql)) {
        for (OrderCreateItem item : items) {
            itemPs.setLong(1, orderId);
            itemPs.setLong(2, item.dishId());
            itemPs.setString(3, item.dishNameSnapshot());
            itemPs.setInt(4, item.priceCentsSnapshot());
            itemPs.setInt(5, item.quantity());
            itemPs.addBatch();
        }
        itemPs.executeBatch();
    }

    return orderId;
}
```

同时需要将 `Database` 注入到 `OrderService` 中。

**方案 B：SQL 层面的乐观锁（版本号）**

在 `dishes` 表中增加 `version` 字段，更新时检查版本号。

**优点：** 无锁，并发性能好
**缺点：** 需要修改表结构；冲突时需要重试逻辑

**方案 C：订单创建时二次校验**

在 `INSERT INTO order_items` 时通过子查询确保菜品仍然可用：

```sql
INSERT INTO order_items (order_id, dish_id, dish_name_snapshot, price_cents_snapshot, quantity)
SELECT ?, ?, d.name, d.price_cents, ?
FROM dishes d
WHERE d.id = ? AND d.is_available = 1
```

**优点：** 简单直接
**缺点：** 无法返回具体哪个菜品不可用的详细信息

**推荐采用方案 A（悲观锁）**，因为：
1. 菜品更新频率远低于订单创建频率，锁竞争少
2. 实现简单，不需要重试逻辑
3. 能保证强一致性

---

## 3. 完整解决方案

### 需要修改的文件

1. **`backend/src/main/java/com/chuanzi/app/service/OrderService.java`**
   - 新增 `previewOrder` 方法用于价格校验
   - 修改 `createOrder` 方法使用共享连接和悲观锁

2. **`backend/src/main/java/com/chuanzi/app/repository/DishRepository.java`**
   - 新增 `findByIdsForUpdate` 方法

3. **`backend/src/main/java/com/chuanzi/app/repository/OrderRepository.java`**
   - 新增支持外部连接的 `createOrderWithItems` 重载方法

4. **`web/assets/js/cart.js`**
   - 新增 `toOrderItemsWithPrice` 方法

5. **`backend/src/main/java/com/chuanzi/app/handler/ApiHandler.java`**（如果需要新增 API 路由）
   - 新增 `POST /api/orders/preview` 路由

### 修改总结

**价格不一致问题：**
- 新增订单预览接口，提前告知用户价格变化
- 用户确认后再创建订单
- 保证用户知情权，避免纠纷

**并发安全问题：**
- 使用 `SELECT ... FOR UPDATE` 对菜品行加锁
- 将"查询菜品 → 检查可用性 → 创建订单"放在同一个数据库事务中
- 消除 Check-Then-Act 竞态条件
- 确保订单创建时菜品状态的一致性

### 方案优缺点分析

**优点：**
1. **数据一致性**：悲观锁保证订单创建时菜品状态不会被并发修改
2. **用户体验**：价格变化时提前通知，用户有选择余地
3. **实现清晰**：职责分离，预览和创建两个独立步骤
4. **可扩展性**：预览接口可扩展用于运费计算、优惠券计算等

**缺点：**
1. **额外 API 调用**：创建订单前需要先调用预览接口
2. **锁等待**：极端情况下商家更新菜品可能需要等待订单创建完成
3. **事务范围扩大**：持有锁的时间变长（但在本场景中影响很小）

**权衡：**
- 对于餐饮点餐场景，菜品更新频率低、订单创建快，悲观锁开销可忽略
- 用户知情权比一次额外的 API 调用更重要
- 方案在一致性和性能之间取得了良好平衡

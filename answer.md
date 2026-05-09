# 购物车价格不一致与并发安全问题分析

## 1. 价格不一致问题

### 前端购物车显示的总价

¥50.00（即 5000 cents）

**原因分析**：`cart.js:38-43` 中 `addToCart` 函数在加入购物车时，将 `dish.priceCents` 作为快照存入购物车项。之后 `totalCents()`（`cart.js:61-63`）基于这些快照价格计算总价。顾客在 10:00 加入购物车时，快照价格为 5000 cents，即使商家后来改价，前端显示仍为 ¥50.00。

### 后端实际创建订单时使用的总价

¥80.00（即 8000 cents）

**原因分析**：`OrderService.java:61-73` 中，后端从数据库重新查询菜品最新价格 `dish.priceCents()` 来计算总价，完全没有使用前端传来的快照价格。实际上 `toOrderItems()`（`cart.js:65-70`）只发送了 `dishId` 和 `quantity`，根本不传价格字段。

### 会导致的问题

1. **用户体验受损**：顾客确认支付 ¥50.00，实际被扣 ¥80.00，存在严重的信任问题，可能引发客诉和纠纷。
2. **法律合规风险**：显示价格与实际扣款不一致，可能违反《价格法》和《消费者权益保护法》中关于明码标价的规定。
3. **数据不一致**：`orders.total_cents` 与顾客看到的价格不匹配，给售后和退款带来困扰。

### 应该如何处理

**核心原则：后端必须以数据库最新价格为准（防篡改），但前端必须在提交前向用户展示最新价格并确认。**

当前后端的做法（使用数据库最新价格计算）是正确的安全策略，因为前端传来的任何价格都不可信。但缺少了关键的"价格变更告知"环节。

---

## 2. 并发安全问题

### 线程A的订单能否成功创建？

**能成功创建。**

线程A 在第4步检查时 `isAvailable == true`，检查通过。虽然线程B 在第4步和第5步之间将菜品下架，但线程A 的代码不会再次检查可用性，而是直接继续执行第5、6步，订单成功创建。

### 违反了什么业务规则？

**已下架的菜品不应被下单。** 商家主动下架菜品意味着该菜品当前不可售卖（可能缺货、停做等），允许对已下架菜品下单会导致商家无法履行订单，造成运营混乱。

### 第3步到第6步之间存在什么问题？

**TOCTOU（Time of Check to Time of Use）竞态条件。** 具体问题：

- 第3步（`dishRepository.findByIds`）和第6步（`orderRepository.createOrderWithItems`）使用的是**不同的数据库连接**，不在同一个事务中。
- 第4步的可用性检查结果在执行到第6步时可能已经过期。
- 在第3步到第6步之间的时间窗口内，菜品的可用性和价格都可能被其他事务修改。

代码流程：
```
第3步: SELECT ... FROM dishes WHERE id IN (...)    -- 连接1，无事务
第4步: 检查 isAvailable                             -- 基于可能已过时的数据
第5步: 计算 total                                    -- 基于可能已过时的数据
第6步: INSERT INTO orders / order_items              -- 连接2，独立事务
```

### 如何修复这个并发漏洞？

需要将读取菜品数据、校验和创建订单放入同一个数据库事务中，并使用适当的锁策略。

---

## 3. 设计改进：完整解决方案

### 3.1 价格不一致的解决方案

#### 方案：提交前价格确认 + 后端价格校验

**前端改进** — 在提交订单前，从后端获取最新价格并展示给用户确认：

```javascript
// customer-menu.js — 修改提交逻辑
submitBtn.addEventListener("click", async () => {
  if (!cart.length) {
    showMessage(messageEl, "购物车为空");
    return;
  }

  try {
    // 先获取最新价格，展示变更
    const latestDishes = await apiRequest("/api/dishes");
    let priceChanged = false;
    const updatedCart = cart.map(item => {
      const latest = latestDishes.find(d => d.id === item.dishId);
      if (!latest) {
        priceChanged = true;
        return { ...item, _unavailable: true };
      }
      if (latest.priceCents !== item.priceCents) {
        priceChanged = true;
        return { ...item, priceCents: latest.priceCents, _priceChanged: true };
      }
      if (!latest.isAvailable) {
        priceChanged = true;
        return { ...item, _unavailable: true };
      }
      return item;
    });

    if (priceChanged) {
      // 提示用户价格变更或菜品下架，由用户确认后重新提交
      const messages = updatedCart
        .filter(item => item._priceChanged || item._unavailable)
        .map(item => {
          if (item._unavailable) return `「${item.name}」已下架或不存在`;
          return `「${item.name}」价格已变更`;
        });
      showMessage(messageEl, "菜品信息变更：" + messages.join("；"));
      // 更新购物车中的价格为最新价格
      cart = updatedCart.filter(item => !item._unavailable).map(({ _priceChanged, _unavailable, ...rest }) => rest);
      saveCart(cart);
      renderCart();
      return;
    }

    const data = await apiRequest("/api/orders", {
      method: "POST",
      body: { items: toOrderItems(cart) }
    });
    clearCart();
    cart = [];
    renderCart();
    showMessage(messageEl, `下单成功，订单号 ${data.orderId}`, "success");
  } catch (error) {
    showMessage(messageEl, error.message || "下单失败");
  }
});
```

**后端改进** — 在返回订单结果时包含价格快照，前端据此展示实际扣款金额：

后端当前实现已经将实际使用的 `totalCents` 返回给前端（`OrderService.java:78`），前端应展示此金额作为最终成交价。

### 3.2 并发安全的解决方案

#### 方案：数据库事务 + 行级锁（SELECT ... FOR UPDATE）

**核心思路**：将菜品查询、校验、订单创建放在同一个事务中，并使用 `SELECT ... FOR UPDATE` 锁定菜品行，防止并发修改。

**修改 DishRepository** — 新增加锁查询方法：

```java
// DishRepository.java — 新增方法
public Map<Long, Dish> findByIdsForUpdate(Connection conn, Set<Long> ids) throws SQLException {
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
    String sql = "SELECT id, name, price_cents, description, is_available, created_at, updated_at "
        + "FROM dishes WHERE id IN (" + placeholders + ") FOR UPDATE";

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
    }
}
```

**修改 OrderRepository** — 暴露事务连接，支持外部事务控制：

```java
// OrderRepository.java — 新增方法，接收外部 Connection
public long createOrderWithItems(Connection conn, long userId, List<OrderCreateItem> items, int totalCents)
        throws SQLException {
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

**修改 OrderService** — 整合为单一事务：

```java
// OrderService.java — 重写 createOrder 方法
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

    try (Connection conn = database.getConnection()) {
        conn.setAutoCommit(false);
        try {
            // 在同一事务中加锁查询菜品
            Map<Long, Dish> dishMap = dishRepository.findByIdsForUpdate(conn, dishIds);

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

            long orderId = orderRepository.createOrderWithItems(conn, authUser.id(), createItems, total);
            conn.commit();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orderId", orderId);
            result.put("totalCents", total);
            result.put("status", "NEW");
            return result;
        } catch (ApiException e) {
            conn.rollback();
            throw e;
        } catch (Exception e) {
            conn.rollback();
            throw new RuntimeException("创建订单失败", e);
        } finally {
            conn.setAutoCommit(true);
        }
    } catch (SQLException e) {
        throw new RuntimeException("获取数据库连接失败", e);
    }
}
```

> **注意**：`OrderService` 需要注入 `Database` 依赖以获取连接进行事务管理。

### 3.3 方案优缺点分析

| 方面 | 优点 | 缺点 |
|------|------|------|
| **SELECT FOR UPDATE 事务方案** | 彻底解决 TOCTOU 竞态条件；保证数据一致性；实现相对简单 | 持有行锁期间阻塞其他写操作（价格修改、上下架），高并发下可能成为瓶颈；需要修改 Repository 层接口，增加 `Connection` 参数传递的复杂度 |
| **前端价格确认方案** | 用户体验好，价格变更时用户知情并确认；减少因价格差异导致的客诉 | 前后端仍可能存在时间差（确认后到实际提交之间价格又变），无法从根本上保证一致性；需要额外的 API 请求 |
| **乐观锁方案（版本号）** | 不阻塞读操作，并发性能好；适合读多写少场景 | 需要在 `dishes` 表增加 `version` 字段；冲突时需要重试逻辑，实现较复杂 |

**推荐组合方案**：

1. **后端**：采用 `SELECT ... FOR UPDATE` 事务方案，从根本上保证并发安全。
2. **前端**：增加提交前的价格确认机制，作为用户体验的补充，让用户在价格变更时知情。
3. **数据库**：`order_items` 表已有 `price_cents_snapshot` 和 `dish_name_snapshot` 字段（`schema.sql:48-49`），确保订单创建后价格和名称不被后续修改影响——这是当前设计已做对的地方。

这种组合方案在保证数据一致性的同时，兼顾了用户体验，且改动范围可控。

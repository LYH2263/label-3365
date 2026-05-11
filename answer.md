# 电商系统价格不一致与并发安全问题分析

## 目录
1. [价格不一致问题分析](#1-价格不一致问题分析)
2. [并发安全问题分析](#2-并发安全问题分析)
3. [完整解决方案设计](#3-完整解决方案设计)
4. [方案优缺点分析](#4-方案优缺点分析)

---

## 1. 价格不一致问题分析

### 1.1 问题现象

**时间线场景：**
- **10:00** - 顾客浏览菜品，看到"宫保鸡丁"价格 ¥50.00，加入购物车
- **10:05** - 商家将"宫保鸡丁"价格修改为 ¥80.00
- **10:10** - 顾客在购物车页面看到总价 ¥50.00，点击"提交订单"

### 1.2 前后端价格对比

| 位置 | 显示/使用的价格 | 计算方式 |
|------|----------------|----------|
| **前端购物车显示** | ¥50.00 | 使用 `cart.js` 中存储的 `priceCents` 快照计算 |
| **后端实际订单** | ¥80.00 | 使用数据库中查询到的最新 `dish.priceCents()` 计算 |

### 1.3 导致的问题

1. **用户体验问题**：用户看到的价格与实际支付价格不一致，产生被欺骗感
2. **信任危机**：用户可能认为平台恶意涨价，流失用户
3. **投诉纠纷**：用户可能发起投诉或取消订单
4. **法律风险**：涉嫌价格欺诈，违反消费者权益保护法

### 1.4 根本原因

**核心问题：前后端采用了不同的价格数据源**

- **前端 (`cart.js:41,62`)**：购物车存储价格快照，使用本地存储的价格计算
  ```javascript
  // 加入购物车时保存价格快照
  priceCents: dish.priceCents
  
  // 计算总价使用快照价格
  export function totalCents(items) {
    return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  }
  ```

- **后端 (`OrderService.java:65`)**：创建订单时重新查询数据库最新价格
  ```java
  // 使用数据库中的最新价格计算
  int lineTotal = dish.priceCents() * itemRequest.quantity();
  ```

---

## 2. 并发安全问题分析

### 2.1 并发场景描述

**线程执行时序：**

```
时间轴 →
  |
  |  线程A（顾客提交订单）
  |    ├─ 第3步：查询菜品，dish.isAvailable() == true ✓
  |    │
  |    │  线程B（商家操作）
  |    │    └─ 更新菜品：isAvailable = false
  |    │
  |    ├─ 第5步：计算总价（使用内存中的dish对象）
  |    └─ 第6步：创建订单成功 ✓
  ↓
```

### 2.2 问题分析

**Q: 线程A的订单能否成功创建？**
- **A: 能成功创建**

**Q: 违反了什么业务规则？**
- **A: 违反了"已下架菜品不能被下单"的业务规则**

**Q: 第3步到第6步之间存在什么问题？**
- **A: 存在"检查然后执行"（Check-Then-Act）的竞态条件**

### 2.3 根本原因

**问题1：缺失数据库层面的并发控制**

代码在第4步检查 `dish.isAvailable()` 时，使用的是第3步查询到的内存对象状态。但这个状态在检查完成后可能被其他线程修改，而代码没有再次验证。

```java
// OrderService.java:47-59
Map<Long, Dish> dishMap = dishRepository.findByIds(dishIds);  // 第3步：查询
for (Long dishId : dishIds) {
    Dish dish = dishMap.get(dishId);
    if (dish == null) { ... }
    else if (!dish.isAvailable()) { ... }  // 第4步：检查（使用内存中的旧数据）
}
// ... 此处可能发生并发修改 ...
// 第5-6步：执行创建订单（没有再次验证）
```

**问题2：事务隔离级别问题**

虽然 `createOrderWithItems` 使用了事务，但默认的事务隔离级别（MySQL默认为REPEATABLE READ）并不能防止"不可重复读"中的数据修改，因为：
1. 菜品查询和订单创建不在同一个数据库连接/事务中
2. 菜品查询是普通SELECT，不是SELECT ... FOR UPDATE

---

## 3. 完整解决方案设计

### 3.1 价格不一致问题解决方案

**方案：后端校验价格一致性，前端增加价格变更提示**

#### 3.1.1 前端修改 (`cart.js`)

**修改点：**
1. 提交订单前向后端确认当前价格
2. 显示价格差异提示，让用户确认是否继续

```javascript
// 新增：验证购物车价格与后端当前价格
export async function validateCartPrices(items) {
  if (items.length === 0) return { valid: true, items: [] };
  
  const dishIds = items.map(item => item.dishId);
  const response = await fetch('/api/dishes/by-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dishIds })
  });
  
  if (!response.ok) throw new Error('价格验证失败');
  
  const currentDishes = await response.json();
  const priceChanges = [];
  
  for (const item of items) {
    const current = currentDishes.find(d => d.id === item.dishId);
    if (current && current.priceCents !== item.priceCents) {
      priceChanges.push({
        dishId: item.dishId,
        name: item.name,
        oldPrice: item.priceCents,
        newPrice: current.priceCents,
        isAvailable: current.isAvailable
      });
    }
  }
  
  return {
    valid: priceChanges.length === 0,
    priceChanges,
    updatedItems: items.map(item => {
      const current = currentDishes.find(d => d.id === item.dishId);
      return current ? { ...item, priceCents: current.priceCents } : item;
    })
  };
}

// 修改 toOrderItems，可选地携带前端价格用于后端校验
export function toOrderItemsWithPriceCheck(items) {
  return items.map((item) => ({
    dishId: item.dishId,
    quantity: item.quantity,
    expectedPriceCents: item.priceCents  // 新增：期望价格
  }));
}
```

#### 3.1.2 后端修改 (`OrderService.java`)

**修改点：**
1. 接收并校验前端传来的期望价格
2. 不一致时返回明确的错误信息

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
    Map<Long, Integer> expectedPrices = new HashMap<>();  // 新增：存储期望价格
    
    for (Map<String, Object> itemMap : itemsPayload) {
        long dishId = toPositiveLong(itemMap.get("dishId"), "dishId");
        int quantity = ValidationUtil.requireQuantity(toInteger(itemMap.get("quantity"), "quantity"));
        itemRequests.add(new ItemRequest(dishId, quantity));
        dishIds.add(dishId);
        
        // 解析前端传来的期望价格（可选字段）
        Object expectedPriceObj = itemMap.get("expectedPriceCents");
        if (expectedPriceObj != null) {
            expectedPrices.put(dishId, toInteger(expectedPriceObj, "expectedPriceCents"));
        }
    }

    Map<Long, Dish> dishMap = dishRepository.findByIds(dishIds);
    List<String> unavailableMessages = new ArrayList<>();
    List<String> priceMismatchMessages = new ArrayList<>();  // 新增：价格不匹配信息
    
    for (Long dishId : dishIds) {
        Dish dish = dishMap.get(dishId);
        if (dish == null) {
            unavailableMessages.add("菜品ID=" + dishId + " 不存在");
        } else if (!dish.isAvailable()) {
            unavailableMessages.add("菜品「" + dish.name() + "」已下架");
        }
        
        // 新增：价格一致性校验
        Integer expectedPrice = expectedPrices.get(dishId);
        if (expectedPrice != null && dish != null && expectedPrice != dish.priceCents()) {
            priceMismatchMessages.add(String.format(
                "菜品「%s」价格已变更：原价 ¥%.2f，现价 ¥%.2f",
                dish.name(),
                expectedPrice / 100.0,
                dish.priceCents() / 100.0
            ));
        }
    }
    
    if (!priceMismatchMessages.isEmpty()) {
        Map<String, Object> errorDetails = new LinkedHashMap<>();
        errorDetails.put("code", "PRICE_MISMATCH");
        errorDetails.put("message", "菜品价格已变更");
        errorDetails.put("details", priceMismatchMessages);
        errorDetails.put("currentDishes", dishMap.values().stream()
            .map(dish -> {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("id", dish.id());
                d.put("name", dish.name());
                d.put("priceCents", dish.priceCents());
                d.put("isAvailable", dish.isAvailable());
                return d;
            })
            .toList());
        throw ApiException.conflictWithDetails("菜品价格已变更", errorDetails);
    }
    
    if (!unavailableMessages.isEmpty()) {
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

    long orderId = orderRepository.createOrderWithItems(authUser.id(), createItems, total);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("orderId", orderId);
    result.put("totalCents", total);
    result.put("status", "NEW");
    return result;
}
```

### 3.2 并发安全问题解决方案

**方案：使用数据库悲观锁 + 在事务内完成检查与创建**

#### 3.2.1 DishRepository 新增悲观锁查询方法

```java
// DishRepository.java
public Map<Long, Dish> findByIdsWithLock(Set<Long> ids, Connection conn) {
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
    // 关键：添加 FOR UPDATE 行锁
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
    } catch (SQLException e) {
        throw new RuntimeException("批量查询菜品失败", e);
    }
}
```

#### 3.2.2 OrderRepository 修改创建订单方法

```java
// OrderRepository.java
public long createOrderWithItemsWithValidation(
    long userId, 
    List<OrderService.ItemRequest> itemRequests,
    Function<Map<Long, Dish>, ValidationResult> validator
) {
    String orderSql = "INSERT INTO orders(user_id, total_cents, status, created_at, updated_at) VALUES (?, ?, 'NEW', ?, ?)";
    String itemSql = "INSERT INTO order_items(order_id, dish_id, dish_name_snapshot, price_cents_snapshot, quantity) VALUES (?, ?, ?, ?, ?)";
    LocalDateTime now = LocalDateTime.now();

    try (Connection conn = database.getConnection()) {
        conn.setAutoCommit(false);
        try {
            // 步骤1：在同一个事务中，先对菜品加锁查询
            Set<Long> dishIds = itemRequests.stream()
                .map(OrderService.ItemRequest::dishId)
                .collect(Collectors.toSet());
            
            Map<Long, Dish> dishMap = dishRepository.findByIdsWithLock(dishIds, conn);
            
            // 步骤2：验证菜品状态和价格（在锁保护下）
            ValidationResult validation = validator.apply(dishMap);
            if (!validation.isValid()) {
                conn.rollback();
                throw ApiException.conflict(validation.getErrorMessage());
            }
            
            // 步骤3：计算总价
            int total = 0;
            List<OrderCreateItem> createItems = new ArrayList<>();
            for (OrderService.ItemRequest itemRequest : itemRequests) {
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
            
            // 步骤4：创建订单
            long orderId;
            try (PreparedStatement orderPs = conn.prepareStatement(orderSql, Statement.RETURN_GENERATED_KEYS)) {
                orderPs.setLong(1, userId);
                orderPs.setInt(2, total);
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
                for (OrderCreateItem item : createItems) {
                    itemPs.setLong(1, orderId);
                    itemPs.setLong(2, item.dishId());
                    itemPs.setString(3, item.dishNameSnapshot());
                    itemPs.setInt(4, item.priceCentsSnapshot());
                    itemPs.setInt(5, item.quantity());
                    itemPs.addBatch();
                }
                itemPs.executeBatch();
            }

            conn.commit();
            return orderId;
        } catch (ApiException e) {
            throw e;
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

// 验证结果类
public static class ValidationResult {
    private final boolean valid;
    private final String errorMessage;
    
    public static ValidationResult ok() {
        return new ValidationResult(true, null);
    }
    
    public static ValidationResult error(String message) {
        return new ValidationResult(false, message);
    }
    
    private ValidationResult(boolean valid, String errorMessage) {
        this.valid = valid;
        this.errorMessage = errorMessage;
    }
    
    public boolean isValid() { return valid; }
    public String getErrorMessage() { return errorMessage; }
}
```

#### 3.2.3 OrderService 最终重构版本

```java
public Map<String, Object> createOrder(AuthUser authUser, List<Map<String, Object>> itemsPayload) {
    if (!"CUSTOMER".equals(authUser.role())) {
        throw ApiException.forbidden("仅顾客可提交订单");
    }
    if (itemsPayload == null || itemsPayload.isEmpty()) {
        throw ApiException.badRequest("订单明细不能为空");
    }

    List<ItemRequest> itemRequests = new ArrayList<>();
    Map<Long, Integer> expectedPrices = new HashMap<>();
    
    for (Map<String, Object> itemMap : itemsPayload) {
        long dishId = toPositiveLong(itemMap.get("dishId"), "dishId");
        int quantity = ValidationUtil.requireQuantity(toInteger(itemMap.get("quantity"), "quantity"));
        itemRequests.add(new ItemRequest(dishId, quantity));
        
        Object expectedPriceObj = itemMap.get("expectedPriceCents");
        if (expectedPriceObj != null) {
            expectedPrices.put(dishId, toInteger(expectedPriceObj, "expectedPriceCents"));
        }
    }

    // 将验证逻辑封装为函数，在事务内加锁后执行
    Function<Map<Long, Dish>, OrderRepository.ValidationResult> validator = dishMap -> {
        List<String> unavailableMessages = new ArrayList<>();
        List<String> priceMismatchMessages = new ArrayList<>();
        
        for (ItemRequest itemRequest : itemRequests) {
            Long dishId = itemRequest.dishId();
            Dish dish = dishMap.get(dishId);
            
            if (dish == null) {
                unavailableMessages.add("菜品ID=" + dishId + " 不存在");
            } else if (!dish.isAvailable()) {
                unavailableMessages.add("菜品「" + dish.name() + "」已下架");
            }
            
            Integer expectedPrice = expectedPrices.get(dishId);
            if (expectedPrice != null && dish != null && expectedPrice != dish.priceCents()) {
                priceMismatchMessages.add(String.format(
                    "菜品「%s」价格已变更", dish.name()
                ));
            }
        }
        
        if (!priceMismatchMessages.isEmpty()) {
            return OrderRepository.ValidationResult.error(
                "部分菜品价格已变更，请刷新后重试：" + String.join("，", priceMismatchMessages)
            );
        }
        
        if (!unavailableMessages.isEmpty()) {
            return OrderRepository.ValidationResult.error(
                String.join("；", unavailableMessages)
            );
        }
        
        return OrderRepository.ValidationResult.ok();
    };

    long orderId = orderRepository.createOrderWithItemsWithValidation(
        authUser.id(), 
        itemRequests, 
        validator
    );
    
    // 查询订单详情返回
    int total = 0;
    Map<Long, Dish> dishMap = dishRepository.findByIds(
        itemRequests.stream().map(ItemRequest::dishId).collect(Collectors.toSet())
    );
    for (ItemRequest itemRequest : itemRequests) {
        Dish dish = dishMap.get(itemRequest.dishId());
        total += dish.priceCents() * itemRequest.quantity();
    }
    
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("orderId", orderId);
    result.put("totalCents", total);
    result.put("status", "NEW");
    return result;
}
```

---

## 4. 方案优缺点分析

### 4.1 价格不一致方案

| 优点 | 缺点 |
|------|------|
| ✅ **用户知情**：价格变更时用户能收到明确提示 | ⚠️ **增加一次API调用**：提交订单前需要验证价格 |
| ✅ **交易公平**：避免价格欺诈风险 | ⚠️ **用户体验略受影响**：可能需要多一次确认 |
| ✅ **后端兜底**：即使前端未校验，后端也会拦截 | ⚠️ **需要前端配合修改**：前后端都需要改动 |
| ✅ **保留快照**：订单创建时仍使用数据库价格，保证财务准确 | |

### 4.2 并发安全方案（悲观锁）

| 优点 | 缺点 |
|------|------|
| ✅ **绝对安全**：数据库行锁保证不会有并发修改问题 | ⚠️ **性能开销**：锁会导致并发订单创建串行化 |
| ✅ **实现简单**：FOR UPDATE 语法简单，易于理解和维护 | ⚠️ **死锁风险**：如果锁定顺序不一致可能产生死锁 |
| ✅ **业务正确**：确保检查和创建在同一事务、同一锁保护下 | ⚠️ **数据库依赖**：依赖InnoDB的行锁机制 |

### 4.3 替代方案对比

#### 方案A：乐观锁（使用 version 字段）

```java
// UPDATE dishes SET ... WHERE id = ? AND version = ?
```
- **优点**：并发性能好，无锁等待
- **缺点**：冲突时需要重试，用户体验差，不适合高冲突场景

#### 方案B：分布式锁（Redis）

```java
// SET lock:dish:{id} NX EX 10
```
- **优点**：不依赖数据库，可跨服务
- **缺点**：增加架构复杂度，需要处理锁超时、锁释放等问题

#### 方案C：状态机 + 最终一致性

- **优点**：极高并发性能
- **缺点**：业务逻辑复杂，需要异步补偿，订单状态不直观

### 4.4 推荐方案总结

**本项目推荐采用：悲观锁方案 + 价格一致性校验**

理由：
1. **餐饮场景并发度不高**：悲观锁的性能影响可以忽略
2. **业务逻辑简单直观**：便于维护和调试
3. **数据一致性优先**：订单数据准确性比极端并发性能更重要
4. **架构简单**：不需要引入额外中间件

**后续优化方向：**
1. 监控锁等待时间，如发现性能瓶颈再考虑乐观锁
2. 增加菜品批量操作时的价格变更通知机制
3. 购物车页面定期（如30秒）自动刷新价格
4. 对高频下架菜品采用缓存预热策略

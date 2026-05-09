package com.chuanzi.app.service;

import com.chuanzi.app.infra.ApiException;
import com.chuanzi.app.model.AuthUser;
import com.chuanzi.app.model.Dish;
import com.chuanzi.app.model.OrderCreateItem;
import com.chuanzi.app.model.OrderStatusInfo;
import com.chuanzi.app.model.OrderView;
import com.chuanzi.app.repository.DishRepository;
import com.chuanzi.app.repository.OrderRepository;
import com.chuanzi.app.util.ValidationUtil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public class OrderService {
    private final DishRepository dishRepository;
    private final OrderRepository orderRepository;

    public OrderService(DishRepository dishRepository, OrderRepository orderRepository) {
        this.dishRepository = dishRepository;
        this.orderRepository = orderRepository;
    }

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

        Map<Long, Dish> dishMap = dishRepository.findByIds(dishIds);
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

    public List<Map<String, Object>> listOrders(AuthUser authUser, String statusFilter) {
        List<OrderView> orders;
        boolean includeCustomer = false;
        if ("MERCHANT".equals(authUser.role())) {
            orders = orderRepository.listOrdersForMerchant(statusFilter);
            includeCustomer = true;
        } else {
            orders = orderRepository.listOrdersForCustomer(authUser.id());
            if (statusFilter != null && !statusFilter.isBlank()) {
                orders = orders.stream().filter(order -> statusFilter.equals(order.status())).toList();
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (OrderView order : orders) {
            result.add(orderRepository.toOrderDto(order, includeCustomer));
        }
        return result;
    }

    public void updateStatus(AuthUser authUser, long orderId, String status) {
        String targetStatus = ValidationUtil.requireStatus(status);
        OrderStatusInfo statusInfo = orderRepository.findOrderStatusInfo(orderId)
            .orElseThrow(() -> ApiException.notFound("订单不存在"));
        String currentStatus = statusInfo.status();

        if ("MERCHANT".equals(authUser.role())) {
            if (!isStatusTransitionAllowed(currentStatus, targetStatus)) {
                throw ApiException.badRequest("非法状态流转: " + currentStatus + " -> " + targetStatus);
            }
        } else if ("CUSTOMER".equals(authUser.role())) {
            if (statusInfo.userId() != authUser.id()) {
                throw ApiException.forbidden("仅可管理自己的订单");
            }
            if (!"CANCELLED".equals(targetStatus)) {
                throw ApiException.forbidden("顾客仅可取消自己的订单");
            }
            if (!"NEW".equals(currentStatus)) {
                throw ApiException.badRequest("仅 NEW 状态订单可取消");
            }
        } else {
            throw ApiException.forbidden("无权限操作订单");
        }

        boolean updated = orderRepository.updateOrderStatus(orderId, targetStatus);
        if (!updated) {
            throw ApiException.notFound("订单不存在");
        }
    }

    public long countOrdersByUserId(long userId) {
        return orderRepository.countOrdersByUserId(userId);
    }

    private boolean isStatusTransitionAllowed(String current, String target) {
        if (current.equals(target)) {
            return true;
        }
        if ("NEW".equals(current)) {
            return "CONFIRMED".equals(target) || "CANCELLED".equals(target);
        }
        if ("CONFIRMED".equals(current)) {
            return "DONE".equals(target);
        }
        return false;
    }

    private long toPositiveLong(Object value, String field) {
        if (value instanceof Number number) {
            long result = number.longValue();
            if (result > 0) {
                return result;
            }
        }
        throw ApiException.badRequest(field + " 必须为正整数");
    }

    private Integer toInteger(Object value, String field) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw ApiException.badRequest(field + " 必须为数字");
    }

    private record ItemRequest(long dishId, int quantity) {
    }
}

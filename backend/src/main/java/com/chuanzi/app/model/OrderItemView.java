package com.chuanzi.app.model;

public record OrderItemView(
    long id,
    long orderId,
    long dishId,
    String dishNameSnapshot,
    int priceCentsSnapshot,
    int quantity
) {
}

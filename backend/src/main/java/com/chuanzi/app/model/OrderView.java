package com.chuanzi.app.model;

import java.util.List;

public record OrderView(
    long id,
    long userId,
    String customerUsername,
    String customerDisplayName,
    int totalCents,
    String status,
    String createdAt,
    String updatedAt,
    List<OrderItemView> items
) {
}

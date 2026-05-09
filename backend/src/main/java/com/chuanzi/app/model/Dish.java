package com.chuanzi.app.model;

public record Dish(
    long id,
    String name,
    int priceCents,
    String description,
    boolean isAvailable,
    String createdAt,
    String updatedAt
) {
}

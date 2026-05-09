package com.chuanzi.app.model;

public record OrderCreateItem(
    long dishId,
    String dishNameSnapshot,
    int priceCentsSnapshot,
    int quantity
) {
}

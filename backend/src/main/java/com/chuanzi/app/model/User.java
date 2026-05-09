package com.chuanzi.app.model;

public record User(
    long id,
    String role,
    String username,
    String passwordHash,
    String displayName,
    String phone,
    String createdAt,
    String updatedAt
) {
}

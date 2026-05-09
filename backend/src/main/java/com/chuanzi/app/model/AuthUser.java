package com.chuanzi.app.model;

public record AuthUser(
    long id,
    String role,
    String username,
    String displayName,
    String phone,
    String sessionToken
) {
}

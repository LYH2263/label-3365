package com.chuanzi.app.util;

import com.chuanzi.app.infra.ApiException;

public final class ValidationUtil {
    private ValidationUtil() {
    }

    public static String requireUsername(String username) {
        if (username == null || !username.matches("^[A-Za-z0-9_]{3,32}$")) {
            throw ApiException.badRequest("用户名需为 3-32 位字母数字下划线");
        }
        return username;
    }

    public static String requirePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 64) {
            throw ApiException.badRequest("密码长度需在 8-64 位");
        }
        return password;
    }

    public static String requireDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank() || displayName.length() > 64) {
            throw ApiException.badRequest("昵称不能为空且长度不超过 64");
        }
        return displayName.trim();
    }

    public static String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return "";
        }
        String normalized = phone.trim();
        if (!normalized.matches("^1\\d{10}$")) {
            throw ApiException.badRequest("手机号格式不正确");
        }
        return normalized;
    }

    public static int requirePriceCents(Integer priceCents) {
        if (priceCents == null || priceCents <= 0 || priceCents > 1_000_000_00) {
            throw ApiException.badRequest("priceCents 必须为正整数且不超过 100000000");
        }
        return priceCents;
    }

    public static int requireQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0 || quantity > 999) {
            throw ApiException.badRequest("quantity 必须在 1-999");
        }
        return quantity;
    }

    public static String requireStatus(String status) {
        if (status == null || !("CONFIRMED".equals(status) || "CANCELLED".equals(status) || "DONE".equals(status))) {
            throw ApiException.badRequest("status 仅支持 CONFIRMED/CANCELLED/DONE");
        }
        return status;
    }
}

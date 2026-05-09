package com.chuanzi.app.service;

import com.chuanzi.app.infra.ApiException;
import com.chuanzi.app.model.AuthUser;
import com.chuanzi.app.model.Dish;
import com.chuanzi.app.repository.DishRepository;
import com.chuanzi.app.util.ValidationUtil;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class DishService {
    private final DishRepository dishRepository;

    public DishService(DishRepository dishRepository) {
        this.dishRepository = dishRepository;
    }

    public List<Map<String, Object>> listDishes(AuthUser authUser, String scope, String keyword, String isAvailable) {
        boolean includeUnavailable = "MERCHANT".equals(authUser.role()) && "all".equalsIgnoreCase(scope);
        Boolean availabilityFilter = parseAvailabilityFilter(isAvailable, includeUnavailable);
        List<Dish> dishes = dishRepository.listDishes(includeUnavailable, normalizeKeyword(keyword), availabilityFilter);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Dish dish : dishes) {
            result.add(dishRepository.toDishDto(dish));
        }
        return result;
    }

    public long createDish(String name, Integer priceCents, String description, Boolean isAvailable) {
        String normalizedName = requireDishName(name);
        int normalizedPrice = ValidationUtil.requirePriceCents(priceCents);
        String normalizedDesc = normalizeDescription(description);
        boolean available = isAvailable != null && isAvailable;
        return dishRepository.createDish(normalizedName, normalizedPrice, normalizedDesc, available);
    }

    public void updateDish(long dishId, String name, Integer priceCents, String description, Boolean isAvailable) {
        String normalizedName = requireDishName(name);
        int normalizedPrice = ValidationUtil.requirePriceCents(priceCents);
        String normalizedDesc = normalizeDescription(description);
        boolean available = isAvailable != null && isAvailable;
        boolean updated = dishRepository.updateDish(dishId, normalizedName, normalizedPrice, normalizedDesc, available);
        if (!updated) {
            throw ApiException.notFound("菜品不存在");
        }
    }

    public void deleteDish(long dishId) {
        if (dishRepository.hasOrderItems(dishId)) {
            throw ApiException.conflict("菜品已有历史订单关联，无法删除，请改为下架");
        }
        boolean deleted = dishRepository.deleteDish(dishId);
        if (!deleted) {
            throw ApiException.notFound("菜品不存在");
        }
    }

    private String requireDishName(String name) {
        if (name == null || name.isBlank() || name.length() > 128) {
            throw ApiException.badRequest("菜品名称不能为空且长度不超过 128");
        }
        return name.trim();
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return "";
        }
        String normalized = description.trim();
        if (normalized.length() > 512) {
            throw ApiException.badRequest("描述长度不能超过 512");
        }
        return normalized;
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return "";
        }
        return keyword.trim();
    }

    private Boolean parseAvailabilityFilter(String isAvailable, boolean includeUnavailable) {
        if (!includeUnavailable || isAvailable == null || isAvailable.isBlank() || "all".equalsIgnoreCase(isAvailable)) {
            return null;
        }
        if ("true".equalsIgnoreCase(isAvailable) || "1".equals(isAvailable)) {
            return true;
        }
        if ("false".equalsIgnoreCase(isAvailable) || "0".equals(isAvailable)) {
            return false;
        }
        throw ApiException.badRequest("isAvailable 仅支持 true/false/all");
    }
}

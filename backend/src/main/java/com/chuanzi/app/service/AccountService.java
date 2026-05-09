package com.chuanzi.app.service;

import com.chuanzi.app.config.AppConfig;
import com.chuanzi.app.infra.ApiException;
import com.chuanzi.app.model.AuthUser;
import com.chuanzi.app.model.User;
import com.chuanzi.app.repository.UserRepository;
import com.chuanzi.app.util.HashUtil;
import com.chuanzi.app.util.ValidationUtil;

import java.util.LinkedHashMap;
import java.util.Map;

public class AccountService {
    private final UserRepository userRepository;
    private final AppConfig config;

    public AccountService(UserRepository userRepository, AppConfig config) {
        this.userRepository = userRepository;
        this.config = config;
    }

    public Map<String, Object> getMe(AuthUser authUser) {
        User user = userRepository.findById(authUser.id())
            .orElseThrow(() -> ApiException.unauthorized("用户不存在或会话已失效"));
        return toUserDto(user);
    }

    public Map<String, Object> updateMe(AuthUser authUser, String displayName, String phone) {
        String normalizedDisplayName = ValidationUtil.requireDisplayName(displayName);
        String normalizedPhone = ValidationUtil.normalizePhone(phone);
        userRepository.updateProfile(authUser.id(), normalizedDisplayName, normalizedPhone);
        User refreshed = userRepository.findById(authUser.id())
            .orElseThrow(() -> ApiException.notFound("用户不存在"));
        return toUserDto(refreshed);
    }

    public void changePassword(AuthUser authUser, String oldPassword, String newPassword) {
        ValidationUtil.requirePassword(oldPassword);
        ValidationUtil.requirePassword(newPassword);
        if (oldPassword.equals(newPassword)) {
            throw ApiException.badRequest("新旧密码不能相同");
        }

        String oldHash = HashUtil.hashPassword(oldPassword, config.passwordSalt());
        String newHash = HashUtil.hashPassword(newPassword, config.passwordSalt());
        boolean updated = userRepository.updatePassword(authUser.id(), oldHash, newHash);
        if (!updated) {
            throw ApiException.badRequest("旧密码错误");
        }
    }

    private Map<String, Object> toUserDto(User user) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", user.id());
        data.put("role", user.role());
        data.put("username", user.username());
        data.put("displayName", user.displayName());
        data.put("phone", user.phone());
        data.put("createdAt", user.createdAt());
        data.put("updatedAt", user.updatedAt());
        return data;
    }
}

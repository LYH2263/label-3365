package com.chuanzi.app.service;

import com.chuanzi.app.config.AppConfig;
import com.chuanzi.app.infra.ApiException;
import com.chuanzi.app.infra.HttpUtil;
import com.chuanzi.app.model.AuthUser;
import com.chuanzi.app.model.User;
import com.chuanzi.app.repository.SessionRepository;
import com.chuanzi.app.repository.UserRepository;
import com.chuanzi.app.util.HashUtil;
import com.chuanzi.app.util.ValidationUtil;
import com.sun.net.httpserver.HttpExchange;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

public class AuthService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final AppConfig config;

    public AuthService(UserRepository userRepository, SessionRepository sessionRepository, AppConfig config) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.config = config;
    }

    public void registerCustomer(String username, String password, String displayName, String phone) {
        String normalizedUsername = ValidationUtil.requireUsername(username);
        ValidationUtil.requirePassword(password);
        String normalizedDisplayName = ValidationUtil.requireDisplayName(displayName);
        String normalizedPhone = ValidationUtil.normalizePhone(phone);

        if (userRepository.findByUsername(normalizedUsername).isPresent()) {
            throw ApiException.conflict("用户名已存在");
        }

        String passwordHash = HashUtil.hashPassword(password, config.passwordSalt());
        userRepository.createCustomer(normalizedUsername, passwordHash, normalizedDisplayName, normalizedPhone);
    }

    public Map<String, Object> login(String username, String password) {
        String normalizedUsername = ValidationUtil.requireUsername(username);
        ValidationUtil.requirePassword(password);

        User user = userRepository.findByUsername(normalizedUsername)
            .orElseThrow(() -> ApiException.unauthorized("用户名或密码错误"));

        String passwordHash = HashUtil.hashPassword(password, config.passwordSalt());
        if (!passwordHash.equals(user.passwordHash())) {
            throw ApiException.unauthorized("用户名或密码错误");
        }

        sessionRepository.cleanupExpiredSessions();
        String token = generateSessionToken();
        sessionRepository.createSession(token, user.id(), LocalDateTime.now().plusHours(config.sessionTtlHours()));

        Map<String, Object> loginData = new LinkedHashMap<>();
        loginData.put("token", token);
        loginData.put("id", user.id());
        loginData.put("role", user.role());
        loginData.put("username", user.username());
        loginData.put("displayName", user.displayName());
        loginData.put("phone", user.phone());
        return loginData;
    }

    public AuthUser requireAuth(HttpExchange exchange) {
        String token = HttpUtil.parseCookies(exchange).get("session_token");
        if (token == null || token.isBlank()) {
            throw ApiException.unauthorized("未登录或会话已过期");
        }
        return sessionRepository.findValidAuthUserByToken(token)
            .orElseThrow(() -> ApiException.unauthorized("未登录或会话已过期"));
    }

    public void requireRole(AuthUser authUser, String role) {
        if (!role.equals(authUser.role())) {
            throw ApiException.forbidden("无权限执行该操作");
        }
    }

    public void logout(HttpExchange exchange) {
        String token = HttpUtil.parseCookies(exchange).get("session_token");
        if (token != null && !token.isBlank()) {
            sessionRepository.deleteByToken(token);
        }
    }

    private String generateSessionToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}

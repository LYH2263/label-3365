package com.chuanzi.app.handler;

import com.chuanzi.app.config.AppConfig;
import com.chuanzi.app.infra.ApiException;
import com.chuanzi.app.infra.ApiResponse;
import com.chuanzi.app.infra.HttpUtil;
import com.chuanzi.app.infra.JsonUtil;
import com.chuanzi.app.model.AuthUser;
import com.chuanzi.app.service.AccountService;
import com.chuanzi.app.service.AuthService;
import com.chuanzi.app.service.DishService;
import com.chuanzi.app.service.OrderService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiHandler implements HttpHandler {
    private static final Pattern DISH_ID_PATTERN = Pattern.compile("^/api/dishes/(\\d+)$");
    private static final Pattern ORDER_STATUS_PATTERN = Pattern.compile("^/api/orders/(\\d+)/status$");

    private final AuthService authService;
    private final AccountService accountService;
    private final DishService dishService;
    private final OrderService orderService;
    private final AppConfig appConfig;

    public ApiHandler(
        AuthService authService,
        AccountService accountService,
        DishService dishService,
        OrderService orderService,
        AppConfig appConfig
    ) {
        this.authService = authService;
        this.accountService = accountService;
        this.dishService = dishService;
        this.orderService = orderService;
        this.appConfig = appConfig;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        try {
            route(exchange);
        } catch (ApiException e) {
            HttpUtil.sendJson(exchange, e.httpStatus(), ApiResponse.error(e.code(), e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            HttpUtil.sendJson(exchange, 500, ApiResponse.error(50000, "服务异常"));
        }
    }

    private void route(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();

        if ("OPTIONS".equalsIgnoreCase(method)) {
            HttpUtil.sendNoContent(exchange, 204);
            return;
        }

        if ("GET".equals(method) && "/api/health".equals(path)) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("status", "UP");
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(data));
            return;
        }

        if ("POST".equals(method) && "/api/auth/register".equals(path)) {
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            authService.registerCustomer(
                asString(body.get("username")),
                asString(body.get("password")),
                asString(body.get("displayName")),
                asString(body.get("phone"))
            );
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("registered", true)));
            return;
        }

        if ("POST".equals(method) && "/api/auth/login".equals(path)) {
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            Map<String, Object> loginData = authService.login(
                asString(body.get("username")),
                asString(body.get("password"))
            );
            String token = (String) loginData.remove("token");
            int maxAge = appConfig.sessionTtlHours() * 3600;
            exchange.getResponseHeaders().add(
                "Set-Cookie",
                "session_token=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge
            );
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(loginData));
            return;
        }

        if ("POST".equals(method) && "/api/auth/logout".equals(path)) {
            authService.requireAuth(exchange);
            authService.logout(exchange);
            exchange.getResponseHeaders().add("Set-Cookie", "session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("logout", true)));
            return;
        }

        if ("GET".equals(method) && "/api/account/me".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(accountService.getMe(authUser)));
            return;
        }

        if ("PUT".equals(method) && "/api/account/me".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            HttpUtil.sendJson(
                exchange,
                200,
                ApiResponse.ok(accountService.updateMe(authUser, asString(body.get("displayName")), asString(body.get("phone"))))
            );
            return;
        }

        if ("PUT".equals(method) && "/api/account/password".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            accountService.changePassword(authUser, asString(body.get("oldPassword")), asString(body.get("newPassword")));
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("changed", true)));
            return;
        }

        if ("GET".equals(method) && "/api/dishes".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            Map<String, String> queryParams = HttpUtil.queryParams(exchange);
            String scope = queryParams.getOrDefault("scope", "");
            String keyword = queryParams.getOrDefault("keyword", "");
            String isAvailable = queryParams.getOrDefault("isAvailable", "");
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(dishService.listDishes(authUser, scope, keyword, isAvailable)));
            return;
        }

        if ("POST".equals(method) && "/api/dishes".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            authService.requireRole(authUser, "MERCHANT");
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            long dishId = dishService.createDish(
                asString(body.get("name")),
                asInteger(body.get("priceCents")),
                asString(body.get("description")),
                asBoolean(body.get("isAvailable"))
            );
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("id", dishId)));
            return;
        }

        Matcher dishMatcher = DISH_ID_PATTERN.matcher(path);
        if ("PUT".equals(method) && dishMatcher.matches()) {
            AuthUser authUser = authService.requireAuth(exchange);
            authService.requireRole(authUser, "MERCHANT");
            long dishId = Long.parseLong(dishMatcher.group(1));
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            dishService.updateDish(
                dishId,
                asString(body.get("name")),
                asInteger(body.get("priceCents")),
                asString(body.get("description")),
                asBoolean(body.get("isAvailable"))
            );
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("updated", true)));
            return;
        }

        if ("DELETE".equals(method) && dishMatcher.matches()) {
            AuthUser authUser = authService.requireAuth(exchange);
            authService.requireRole(authUser, "MERCHANT");
            long dishId = Long.parseLong(dishMatcher.group(1));
            dishService.deleteDish(dishId);
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("deleted", true)));
            return;
        }

        if ("GET".equals(method) && "/api/orders".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            String status = HttpUtil.queryParams(exchange).getOrDefault("status", "");
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(orderService.listOrders(authUser, status)));
            return;
        }

        if ("POST".equals(method) && "/api/orders".equals(path)) {
            AuthUser authUser = authService.requireAuth(exchange);
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            Object itemsObj = body.get("items");
            if (!(itemsObj instanceof List<?> itemsRaw)) {
                throw ApiException.badRequest("items 必须为数组");
            }
            List<Map<String, Object>> items = itemsRaw.stream().map(this::castToMap).toList();
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(orderService.createOrder(authUser, items)));
            return;
        }

        Matcher orderStatusMatcher = ORDER_STATUS_PATTERN.matcher(path);
        if ("PUT".equals(method) && orderStatusMatcher.matches()) {
            AuthUser authUser = authService.requireAuth(exchange);
            long orderId = Long.parseLong(orderStatusMatcher.group(1));
            Map<String, Object> body = JsonUtil.parseMap(exchange.getRequestBody());
            orderService.updateStatus(authUser, orderId, asString(body.get("status")));
            HttpUtil.sendJson(exchange, 200, ApiResponse.ok(Map.of("updated", true)));
            return;
        }

        throw ApiException.notFound("接口不存在: " + method + " " + path);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToMap(Object obj) {
        if (obj instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        throw ApiException.badRequest("items 元素格式错误");
    }

    private String asString(Object value) {
        if (value == null) {
            return "";
        }
        return String.valueOf(value).trim();
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw ApiException.badRequest("字段类型错误，期望整数");
    }

    private Boolean asBoolean(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof Number n) {
            return n.intValue() != 0;
        }
        if (value instanceof String s) {
            return "true".equalsIgnoreCase(s) || "1".equals(s);
        }
        return false;
    }
}

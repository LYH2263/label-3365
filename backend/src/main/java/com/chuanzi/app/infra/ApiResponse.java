package com.chuanzi.app.infra;

import java.util.LinkedHashMap;
import java.util.Map;

public final class ApiResponse {
    private ApiResponse() {
    }

    public static Map<String, Object> ok(Object data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 0);
        response.put("message", "ok");
        response.put("data", data);
        return response;
    }

    public static Map<String, Object> error(int code, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", code);
        response.put("message", message);
        response.put("data", null);
        return response;
    }
}

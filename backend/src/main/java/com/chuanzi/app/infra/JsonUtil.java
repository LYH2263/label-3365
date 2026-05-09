package com.chuanzi.app.infra;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

public final class JsonUtil {
    public static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonUtil() {
    }

    public static Map<String, Object> parseMap(InputStream inputStream) {
        try {
            return MAPPER.readValue(inputStream, new TypeReference<>() {
            });
        } catch (IOException e) {
            throw ApiException.badRequest("请求体 JSON 格式错误");
        }
    }

    public static String stringify(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (IOException e) {
            throw ApiException.internal("JSON 序列化失败");
        }
    }
}

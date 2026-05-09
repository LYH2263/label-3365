package com.chuanzi.app.config;

public record AppConfig(
    int appPort,
    String dbHost,
    int dbPort,
    String dbName,
    String dbUser,
    String dbPassword,
    int sessionTtlHours,
    String passwordSalt,
    String webRoot
) {

    public static AppConfig fromEnv() {
        return new AppConfig(
            envInt("APP_PORT", 8080),
            envStr("DB_HOST", "127.0.0.1"),
            envInt("DB_PORT", 3306),
            envStr("DB_NAME", "chuanzi"),
            envStr("DB_USER", "root"),
            envStr("DB_PASSWORD", "root"),
            envInt("SESSION_TTL_HOURS", 24),
            envStr("APP_PASSWORD_SALT", "chuanzi-default-salt"),
            envStr("WEB_ROOT", "web")
        );
    }

    public String jdbcUrl() {
        return "jdbc:mysql://" + dbHost + ":" + dbPort + "/" + dbName
            + "?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true";
    }

    private static String envStr(String key, String defaultValue) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private static int envInt(String key, int defaultValue) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }
}

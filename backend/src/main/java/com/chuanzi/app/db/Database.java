package com.chuanzi.app.db;

import com.chuanzi.app.config.AppConfig;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Database {
    private final AppConfig config;

    public Database(AppConfig config) {
        this.config = config;
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("MySQL JDBC 驱动未找到", e);
        }
    }

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(config.jdbcUrl(), config.dbUser(), config.dbPassword());
    }
}

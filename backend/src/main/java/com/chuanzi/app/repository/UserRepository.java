package com.chuanzi.app.repository;

import com.chuanzi.app.db.Database;
import com.chuanzi.app.model.User;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Optional;

public class UserRepository {
    private final Database database;

    public UserRepository(Database database) {
        this.database = database;
    }

    public Optional<User> findByUsername(String username) {
        String sql = "SELECT id, role, username, password_hash, display_name, phone, created_at, updated_at FROM users WHERE username = ?";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapUser(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("查询用户失败", e);
        }
    }

    public Optional<User> findById(long id) {
        String sql = "SELECT id, role, username, password_hash, display_name, phone, created_at, updated_at FROM users WHERE id = ?";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapUser(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("查询用户失败", e);
        }
    }

    public long createCustomer(String username, String passwordHash, String displayName, String phone) {
        String sql = "INSERT INTO users(role, username, password_hash, display_name, phone, created_at, updated_at) VALUES('CUSTOMER', ?, ?, ?, ?, ?, ?)";
        LocalDateTime now = LocalDateTime.now();
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, username);
            ps.setString(2, passwordHash);
            ps.setString(3, displayName);
            ps.setString(4, phone);
            ps.setObject(5, now);
            ps.setObject(6, now);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
            throw new RuntimeException("创建用户失败，未返回主键");
        } catch (SQLException e) {
            throw new RuntimeException("创建用户失败", e);
        }
    }

    public void updateProfile(long userId, String displayName, String phone) {
        String sql = "UPDATE users SET display_name = ?, phone = ?, updated_at = ? WHERE id = ?";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, displayName);
            ps.setString(2, phone);
            ps.setObject(3, LocalDateTime.now());
            ps.setLong(4, userId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("更新用户信息失败", e);
        }
    }

    public boolean updatePassword(long userId, String oldPasswordHash, String newPasswordHash) {
        String sql = "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND password_hash = ?";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newPasswordHash);
            ps.setObject(2, LocalDateTime.now());
            ps.setLong(3, userId);
            ps.setString(4, oldPasswordHash);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("更新密码失败", e);
        }
    }

    private User mapUser(ResultSet rs) throws SQLException {
        return new User(
            rs.getLong("id"),
            rs.getString("role"),
            rs.getString("username"),
            rs.getString("password_hash"),
            rs.getString("display_name"),
            rs.getString("phone"),
            rs.getTimestamp("created_at").toLocalDateTime().toString(),
            rs.getTimestamp("updated_at").toLocalDateTime().toString()
        );
    }
}

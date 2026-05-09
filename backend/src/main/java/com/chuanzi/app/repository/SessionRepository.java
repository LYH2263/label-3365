package com.chuanzi.app.repository;

import com.chuanzi.app.db.Database;
import com.chuanzi.app.model.AuthUser;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Optional;

public class SessionRepository {
    private final Database database;

    public SessionRepository(Database database) {
        this.database = database;
    }

    public void createSession(String token, long userId, LocalDateTime expiresAt) {
        String sql = "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, token);
            ps.setLong(2, userId);
            ps.setObject(3, expiresAt);
            ps.setObject(4, LocalDateTime.now());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("创建会话失败", e);
        }
    }

    public Optional<AuthUser> findValidAuthUserByToken(String token) {
        String sql = "SELECT u.id, u.role, u.username, u.display_name, u.phone "
            + "FROM sessions s JOIN users u ON u.id = s.user_id "
            + "WHERE s.token = ? AND s.expires_at > NOW()";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, token);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(new AuthUser(
                        rs.getLong("id"),
                        rs.getString("role"),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("phone"),
                        token
                    ));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("查询会话失败", e);
        }
    }

    public void deleteByToken(String token) {
        String sql = "DELETE FROM sessions WHERE token = ?";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, token);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("删除会话失败", e);
        }
    }

    public void cleanupExpiredSessions() {
        String sql = "DELETE FROM sessions WHERE expires_at <= NOW()";
        try (Connection conn = database.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("清理过期会话失败", e);
        }
    }
}

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS chuanzi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chuanzi;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role VARCHAR(16) NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  phone VARCHAR(32) DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT uk_users_username UNIQUE (username),
  CONSTRAINT ck_users_role CHECK (role IN ('CUSTOMER', 'MERCHANT'))
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS dishes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  price_cents INT NOT NULL,
  description VARCHAR(512) DEFAULT '',
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT ck_dishes_price CHECK (price_cents > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  total_cents INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_orders_status CHECK (status IN ('NEW', 'CONFIRMED', 'CANCELLED', 'DONE')),
  CONSTRAINT ck_orders_total CHECK (total_cents >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  dish_id BIGINT NOT NULL,
  dish_name_snapshot VARCHAR(128) NOT NULL,
  price_cents_snapshot INT NOT NULL,
  quantity INT NOT NULL,
  KEY idx_order_items_order_id (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_dish FOREIGN KEY (dish_id) REFERENCES dishes(id),
  CONSTRAINT ck_order_items_price CHECK (price_cents_snapshot > 0),
  CONSTRAINT ck_order_items_qty CHECK (quantity > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE = InnoDB;

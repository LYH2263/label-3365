SET NAMES utf8mb4;
USE chuanzi;

-- 修复历史导入时因 latin1 客户端导致的中文乱码
UPDATE users
SET
  display_name = CONVERT(BINARY CONVERT(display_name USING latin1) USING utf8mb4),
  updated_at = NOW()
WHERE HEX(display_name) REGEXP '^(C2|C3)';

UPDATE dishes
SET
  name = CONVERT(BINARY CONVERT(name USING latin1) USING utf8mb4),
  description = CONVERT(BINARY CONVERT(description USING latin1) USING utf8mb4),
  updated_at = NOW()
WHERE HEX(name) REGEXP '^(C2|C3)' OR HEX(description) REGEXP '^(C2|C3)';

UPDATE order_items
SET dish_name_snapshot = CONVERT(BINARY CONVERT(dish_name_snapshot USING latin1) USING utf8mb4)
WHERE HEX(dish_name_snapshot) REGEXP '^(C2|C3)';

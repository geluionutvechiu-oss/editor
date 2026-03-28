-- Migrare: linii separate mobile / STB + câmp device_type în connection_logs
-- Rulează: mysql -u root -p iptv_panel < 001_add_device_connections.sql

-- Coloane noi în users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS max_mobile_connections TINYINT UNSIGNED NOT NULL DEFAULT 1
    COMMENT 'Conexiuni simultane de pe telefon/tabletă' AFTER max_connections,
  ADD COLUMN IF NOT EXISTS max_stb_connections TINYINT UNSIGNED NOT NULL DEFAULT 1
    COMMENT 'Conexiuni simultane de pe Smart TV / STB' AFTER max_mobile_connections;

-- Coloană device_type în connection_logs
ALTER TABLE connection_logs
  ADD COLUMN IF NOT EXISTS device_type ENUM('desktop','mobile','tablet','stb','other','unknown')
    NOT NULL DEFAULT 'unknown'
    COMMENT 'Tipul dispozitivului detectat din User-Agent'
    AFTER city;

CREATE INDEX IF NOT EXISTS idx_conn_logs_device ON connection_logs (device_type);

-- Actualizare utilizatori existenți: implicit 1 conexiune mobile/stb
UPDATE users SET
  max_mobile_connections = 1,
  max_stb_connections    = 1
WHERE max_mobile_connections = 0 OR max_stb_connections = 0;

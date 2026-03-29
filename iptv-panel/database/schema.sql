-- ============================================================
-- IPTV Management Panel - Complete MySQL Schema
-- Production-ready, optimized for high-traffic IPTV workloads
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- SERVERS & INFRASTRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS `servers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `domain` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `http_port` SMALLINT UNSIGNED NOT NULL DEFAULT 8080,
  `https_port` SMALLINT UNSIGNED NOT NULL DEFAULT 8443,
  `rtmp_port` SMALLINT UNSIGNED NOT NULL DEFAULT 1935,
  `hls_port` SMALLINT UNSIGNED NOT NULL DEFAULT 8888,
  `server_protocol` ENUM('http','https') NOT NULL DEFAULT 'http',
  `rtmp_url` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('online','offline','maintenance') NOT NULL DEFAULT 'online',
  `cpu_load` DECIMAL(5,2) DEFAULT 0.00,
  `ram_usage` DECIMAL(5,2) DEFAULT 0.00,
  `bandwidth_in` BIGINT UNSIGNED DEFAULT 0,
  `bandwidth_out` BIGINT UNSIGNED DEFAULT 0,
  `total_clients` INT UNSIGNED DEFAULT 0,
  `max_clients` INT UNSIGNED NOT NULL DEFAULT 1000,
  `is_load_balancer` TINYINT(1) NOT NULL DEFAULT 0,
  `weight` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Load balancer weight 1-10',
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'UTC',
  `notes` TEXT DEFAULT NULL,
  `last_ping` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_domain` (`domain`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password` VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  `email` VARCHAR(255) DEFAULT NULL,
  `role` ENUM('admin','reseller','user') NOT NULL DEFAULT 'user',
  `reseller_id` INT UNSIGNED DEFAULT NULL COMMENT 'parent reseller user_id',
  `max_connections` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `max_mobile_connections` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'max simultane telefoane mobile/tablet',
  `max_stb_connections` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'max simultane Smart TV / STB',
  `allowed_output_formats` SET('m3u8','ts','rtmp') NOT NULL DEFAULT 'm3u8,ts',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_banned` TINYINT(1) NOT NULL DEFAULT 0,
  `ban_reason` VARCHAR(500) DEFAULT NULL,
  `ip_whitelist` TEXT DEFAULT NULL COMMENT 'JSON array of allowed IPs',
  `exp_date` DATETIME DEFAULT NULL COMMENT 'NULL = never expires',
  `member_since` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `trial_mode` TINYINT(1) NOT NULL DEFAULT 0,
  `bouquet_id` INT UNSIGNED DEFAULT NULL,
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'UTC',
  `last_login` DATETIME DEFAULT NULL,
  `last_login_ip` VARCHAR(45) DEFAULT NULL,
  `last_user_agent` VARCHAR(500) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_reseller` (`reseller_id`),
  KEY `idx_exp_date` (`exp_date`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_bouquet` (`bouquet_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `resellers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `credits` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `credits_used` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `max_clients` INT UNSIGNED NOT NULL DEFAULT 100,
  `current_clients` INT UNSIGNED NOT NULL DEFAULT 0,
  `dns` VARCHAR(255) DEFAULT NULL COMMENT 'Custom panel domain',
  `panel_url` VARCHAR(500) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `plan_id` INT UNSIGNED DEFAULT NULL,
  `plan_name` VARCHAR(100) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 0,
  `payment_method` VARCHAR(50) DEFAULT NULL,
  `payment_ref` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('active','expired','cancelled','pending') NOT NULL DEFAULT 'pending',
  `notes` TEXT DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_end_date` (`end_date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `duration_days` SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  `max_connections` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `bouquet_id` INT UNSIGNED DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BOUQUETS (Channel Packages)
-- ============================================================

CREATE TABLE IF NOT EXISTS `bouquets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `welcome_message` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bouquet_streams` (
  `bouquet_id` INT UNSIGNED NOT NULL,
  `stream_id` INT UNSIGNED NOT NULL,
  `stream_type` ENUM('live','vod','series') NOT NULL DEFAULT 'live',
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`bouquet_id`,`stream_id`,`stream_type`),
  KEY `idx_stream` (`stream_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- STREAM CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS `stream_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_name` VARCHAR(150) NOT NULL,
  `parent_id` INT UNSIGNED DEFAULT NULL,
  `category_type` ENUM('live','vod','series') NOT NULL DEFAULT 'live',
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`category_type`),
  KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LIVE STREAMS
-- ============================================================

CREATE TABLE IF NOT EXISTS `streams` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `num` INT UNSIGNED DEFAULT NULL COMMENT 'Display number / channel number',
  `name` VARCHAR(255) NOT NULL,
  `stream_display_name` VARCHAR(255) DEFAULT NULL,
  `stream_icon` VARCHAR(1000) DEFAULT NULL COMMENT 'Logo URL',
  `epg_channel_id` VARCHAR(255) DEFAULT NULL COMMENT 'tvg-id for EPG mapping',
  `added` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `category_id` INT UNSIGNED DEFAULT NULL,
  `custom_sid` VARCHAR(100) DEFAULT NULL,
  `tv_archive` TINYINT(1) NOT NULL DEFAULT 0,
  `direct_source` VARCHAR(2000) DEFAULT NULL COMMENT 'Primary source URL',
  `tv_archive_duration` SMALLINT UNSIGNED DEFAULT 0 COMMENT 'Hours',
  `stream_source` JSON DEFAULT NULL COMMENT 'Array of source URLs for failover',
  `stream_type` ENUM('live','vod','series') NOT NULL DEFAULT 'live',
  `stream_status` ENUM('online','offline','unknown') NOT NULL DEFAULT 'unknown',
  `last_status_check` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `server_id` INT UNSIGNED DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_epg` (`epg_channel_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_status` (`stream_status`),
  KEY `idx_num` (`num`),
  FOREIGN KEY (`category_id`) REFERENCES `stream_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VOD (Video on Demand)
-- ============================================================

CREATE TABLE IF NOT EXISTS `vod_streams` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vod_name` VARCHAR(500) NOT NULL,
  `added` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `category_id` INT UNSIGNED DEFAULT NULL,
  `container_extension` VARCHAR(10) NOT NULL DEFAULT 'mkv',
  `custom_sid` VARCHAR(100) DEFAULT NULL,
  `stream_icon` VARCHAR(1000) DEFAULT NULL,
  `stream_source` VARCHAR(2000) NOT NULL,
  `stream_status` ENUM('online','offline','unknown') NOT NULL DEFAULT 'unknown',
  `tmdb_id` INT UNSIGNED DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  -- TMDB metadata
  `movie_image` VARCHAR(1000) DEFAULT NULL,
  `releaseDate` DATE DEFAULT NULL,
  `youtube_trailer` VARCHAR(200) DEFAULT NULL,
  `genre` VARCHAR(500) DEFAULT NULL,
  `plot` TEXT DEFAULT NULL,
  `cast` TEXT DEFAULT NULL COMMENT 'JSON array',
  `director` VARCHAR(500) DEFAULT NULL,
  `actors` TEXT DEFAULT NULL,
  `age` VARCHAR(10) DEFAULT NULL,
  `movie_rating` DECIMAL(3,1) DEFAULT NULL,
  `movie_rating_count` INT UNSIGNED DEFAULT NULL,
  `backdrop_path` VARCHAR(1000) DEFAULT NULL,
  `duration_secs` INT UNSIGNED DEFAULT NULL,
  `duration` VARCHAR(20) DEFAULT NULL,
  `bitrate` INT UNSIGNED DEFAULT NULL,
  `video` JSON DEFAULT NULL COMMENT 'video codec info',
  `audio` JSON DEFAULT NULL COMMENT 'audio codec info',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_tmdb` (`tmdb_id`),
  KEY `idx_active` (`is_active`),
  FOREIGN KEY (`category_id`) REFERENCES `stream_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SERIES
-- ============================================================

CREATE TABLE IF NOT EXISTS `series` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(500) NOT NULL,
  `cover` VARCHAR(1000) DEFAULT NULL,
  `plot` TEXT DEFAULT NULL,
  `cast` TEXT DEFAULT NULL COMMENT 'JSON array',
  `director` VARCHAR(500) DEFAULT NULL,
  `genre` VARCHAR(500) DEFAULT NULL,
  `releaseDate` YEAR DEFAULT NULL,
  `last_modified` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `rating` DECIMAL(3,1) DEFAULT NULL,
  `rating_5based` DECIMAL(3,2) DEFAULT NULL,
  `backdrop_path` JSON DEFAULT NULL,
  `youtube_trailer` VARCHAR(200) DEFAULT NULL,
  `episode_run_time` SMALLINT UNSIGNED DEFAULT NULL,
  `category_id` INT UNSIGNED DEFAULT NULL,
  `tmdb_id` INT UNSIGNED DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_tmdb` (`tmdb_id`),
  FOREIGN KEY (`category_id`) REFERENCES `stream_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `seasons` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `series_id` INT UNSIGNED NOT NULL,
  `season_num` TINYINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) DEFAULT NULL,
  `overview` TEXT DEFAULT NULL,
  `cover_big` VARCHAR(1000) DEFAULT NULL,
  `air_date` DATE DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_series_season` (`series_id`, `season_num`),
  FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `episodes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `series_id` INT UNSIGNED NOT NULL,
  `season_id` INT UNSIGNED DEFAULT NULL,
  `season_num` TINYINT UNSIGNED NOT NULL,
  `episode_num` SMALLINT UNSIGNED NOT NULL,
  `title` VARCHAR(500) DEFAULT NULL,
  `container_extension` VARCHAR(10) NOT NULL DEFAULT 'mkv',
  `stream_source` VARCHAR(2000) NOT NULL,
  `stream_status` ENUM('online','offline','unknown') NOT NULL DEFAULT 'unknown',
  `info` JSON DEFAULT NULL COMMENT 'plot, duration, video/audio info',
  `movie_image` VARCHAR(1000) DEFAULT NULL,
  `duration_secs` INT UNSIGNED DEFAULT NULL,
  `duration` VARCHAR(20) DEFAULT NULL,
  `bitrate` INT UNSIGNED DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `added` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_series` (`series_id`),
  KEY `idx_season` (`season_id`),
  FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- EPG DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS `epg_sources` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `url` VARCHAR(2000) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_updated` DATETIME DEFAULT NULL,
  `update_frequency_hours` TINYINT UNSIGNED NOT NULL DEFAULT 12,
  `encoding` VARCHAR(20) NOT NULL DEFAULT 'UTF-8',
  `channel_count` INT UNSIGNED DEFAULT 0,
  `event_count` INT UNSIGNED DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `epg_channels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `source_id` INT UNSIGNED NOT NULL,
  `channel_id` VARCHAR(255) NOT NULL COMMENT 'tvg-id from XMLTV',
  `display_name` VARCHAR(255) NOT NULL,
  `icon` VARCHAR(1000) DEFAULT NULL,
  `lang` VARCHAR(10) DEFAULT NULL,
  UNIQUE KEY `uq_source_channel` (`source_id`, `channel_id`),
  PRIMARY KEY (`id`),
  KEY `idx_channel_id` (`channel_id`),
  FOREIGN KEY (`source_id`) REFERENCES `epg_sources`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `epg_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel_id` VARCHAR(255) NOT NULL COMMENT 'tvg-id',
  `epg_id` VARCHAR(255) NOT NULL COMMENT 'XMLTV programme id',
  `start` DATETIME NOT NULL,
  `end` DATETIME NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `lang` VARCHAR(10) DEFAULT 'en',
  `description` TEXT DEFAULT NULL,
  `icon` VARCHAR(1000) DEFAULT NULL,
  `category` VARCHAR(255) DEFAULT NULL,
  `episode_num` VARCHAR(100) DEFAULT NULL COMMENT 'S01E01 or xmltv_ns format',
  `has_archive` TINYINT(1) NOT NULL DEFAULT 0,
  `source_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_channel_time` (`channel_id`, `start`, `end`),
  KEY `idx_start` (`start`),
  KEY `idx_end` (`end`),
  FOREIGN KEY (`source_id`) REFERENCES `epg_sources`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(`start`)) (
  PARTITION p_old VALUES LESS THAN (TO_DAYS('2024-01-01')),
  PARTITION p_2024 VALUES LESS THAN (TO_DAYS('2025-01-01')),
  PARTITION p_2025 VALUES LESS THAN (TO_DAYS('2026-01-01')),
  PARTITION p_2026 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- ============================================================
-- CONNECTION LOGS & ACTIVE SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `connection_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `stream_id` INT UNSIGNED DEFAULT NULL,
  `stream_type` ENUM('live','vod','series') DEFAULT 'live',
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `device_type` VARCHAR(50) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `isp` VARCHAR(255) DEFAULT NULL,
  `connected_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `disconnected_at` DATETIME DEFAULT NULL,
  `bytes_received` BIGINT UNSIGNED DEFAULT 0,
  `duration_secs` INT UNSIGNED DEFAULT 0,
  `server_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_stream` (`stream_id`),
  KEY `idx_connected` (`connected_at`),
  KEY `idx_ip` (`ip_address`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `active_connections` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `stream_id` INT UNSIGNED DEFAULT NULL,
  `stream_type` ENUM('live','vod','series') DEFAULT 'live',
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `session_token` VARCHAR(64) NOT NULL,
  `connected_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_heartbeat` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `server_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session` (`session_token`),
  KEY `idx_user` (`user_id`),
  KEY `idx_heartbeat` (`last_heartbeat`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CONTINUE WATCHING
-- ============================================================

CREATE TABLE IF NOT EXISTS `user_watch_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `stream_id` INT UNSIGNED NOT NULL,
  `stream_type` ENUM('vod','series') NOT NULL DEFAULT 'vod',
  `episode_id` INT UNSIGNED DEFAULT NULL,
  `position_secs` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Playback position',
  `duration_secs` INT UNSIGNED DEFAULT NULL,
  `completed` TINYINT(1) NOT NULL DEFAULT 0,
  `watched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_stream` (`user_id`, `stream_id`, `stream_type`, `episode_id`),
  KEY `idx_user_watched` (`user_id`, `watched_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- IP BLACKLIST / WHITELIST
-- ============================================================

CREATE TABLE IF NOT EXISTS `ip_filter` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip_address` VARCHAR(45) NOT NULL,
  `cidr` VARCHAR(50) DEFAULT NULL COMMENT 'e.g. 192.168.1.0/24',
  `type` ENUM('blacklist','whitelist') NOT NULL DEFAULT 'blacklist',
  `reason` VARCHAR(500) DEFAULT NULL,
  `expires_at` DATETIME DEFAULT NULL COMMENT 'NULL = permanent',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ip` (`ip_address`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- RESELLER CREDITS LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reseller_id` INT UNSIGNED NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `type` ENUM('credit','debit') NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `balance_after` DECIMAL(10,2) NOT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reseller` (`reseller_id`),
  FOREIGN KEY (`reseller_id`) REFERENCES `resellers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT DEFAULT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `type` ENUM('string','integer','boolean','json','text') NOT NULL DEFAULT 'string',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL COMMENT 'NULL = broadcast to all',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('info','warning','success','error') NOT NULL DEFAULT 'info',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- DEFAULT DATA
-- ============================================================

INSERT INTO `settings` (`key`, `value`, `description`, `type`) VALUES
('panel_name', 'IPTV Panel', 'Panel display name', 'string'),
('panel_url', 'http://localhost', 'Panel base URL', 'string'),
('tmdb_api_key', '', 'TMDB API key for metadata', 'string'),
('epg_auto_update', '1', 'Auto-update EPG every 12h', 'boolean'),
('epg_update_hours', '12', 'EPG update interval in hours', 'integer'),
('max_login_attempts', '5', 'Max failed logins before block', 'integer'),
('session_timeout', '86400', 'JWT token TTL in seconds', 'integer'),
('connection_cleanup_mins', '5', 'Remove stale connections after N minutes', 'integer'),
('registration_enabled', '0', 'Allow public registration', 'boolean'),
('trial_days', '1', 'Free trial duration in days', 'integer'),
('smtp_host', '', 'SMTP server hostname', 'string'),
('smtp_port', '587', 'SMTP server port', 'integer'),
('smtp_user', '', 'SMTP username', 'string'),
('smtp_pass', '', 'SMTP password', 'string'),
('smtp_from', '', 'From email address', 'string'),
('bandwidth_limit_mbps', '0', '0 = unlimited per user', 'integer'),
('server_timezone', 'UTC', 'Server timezone', 'string'),
('maintenance_mode', '0', 'Put panel in maintenance mode', 'boolean')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

INSERT INTO `stream_categories` (`category_name`, `category_type`) VALUES
('General', 'live'),
('Sports', 'live'),
('News', 'live'),
('Movies', 'vod'),
('Series', 'series');

INSERT INTO `bouquets` (`name`, `description`) VALUES
('All Channels', 'Access to all channels and content');

-- ============================================================
-- INDEXES for performance
-- ============================================================

CREATE INDEX idx_epg_channel_start ON epg_data (channel_id, start);
CREATE INDEX idx_streams_active_cat ON streams (is_active, category_id);
CREATE INDEX idx_vod_active_cat ON vod_streams (is_active, category_id);
CREATE INDEX idx_users_active_exp ON users (is_active, exp_date);

-- CAPOY — 2FA TOTP enrollment storage
-- Adds columns to admin_users (totp secret + recovery codes + last-used-window)
-- and an audit log table dedicated to 2FA events for forensic review.

ALTER TABLE admin_users
  ADD COLUMN totp_secret_encrypted VARCHAR(512) NULL AFTER password_hash,
  ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret_encrypted,
  ADD COLUMN totp_enabled_at DATETIME NULL AFTER totp_enabled,
  ADD COLUMN totp_recovery_codes_encrypted VARCHAR(2048) NULL AFTER totp_enabled_at,
  ADD COLUMN totp_last_used_step BIGINT UNSIGNED NULL AFTER totp_recovery_codes_encrypted;

-- Optional: keep a small 2FA-specific audit log table for clarity.
-- This is in addition to admin_audit_log; we still log high-level events there too.
CREATE TABLE IF NOT EXISTS admin_two_factor_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_2fa_user_time (user_id, created_at),
  KEY idx_2fa_event (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for fast lookup of active totp-enabled users (rare query path)
ALTER TABLE admin_users
  ADD INDEX idx_admin_users_totp_enabled (totp_enabled);

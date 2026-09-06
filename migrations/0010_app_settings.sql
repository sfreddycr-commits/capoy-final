-- CAPOY — Configuración V1
-- Configuración operativa no secreta. No almacenar credenciales, tokens ni contraseñas aquí.

CREATE TABLE app_settings (
  setting_key VARCHAR(80) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  KEY idx_app_settings_updated_by (updated_by_admin_id),
  CONSTRAINT fk_app_settings_updated_by FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value) VALUES
('business_name','Capoy Costa Rica'),
('timezone','America/Costa_Rica'),
('default_currency','USD'),
('default_language','es'),
('booking_email',''),
('booking_phone',''),
('reservation_prefix','CAP'),
('maintenance_mode','false')
ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);

CREATE TABLE IF NOT EXISTS cms_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cms_updated_by FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO cms_settings (setting_key, setting_value) VALUES
('hero_eyebrow','Explora'),
('hero_title','Costa Rica como nunca antes'),
('hero_lead','Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país.'),
('hero_primary_cta','Ver tours'),
('hero_secondary_cta','Planear mi viaje'),
('hero_image',''),
('contact_phone','+506 8880-1234'),
('contact_email','info@capoycostarica.com'),
('contact_location','La Fortuna, Alajuela, Costa Rica'),
('cta_title','¿Listo para tu próxima aventura?'),
('cta_copy','Reserva hoy y vive Costa Rica como nunca antes. Tu mejor historia comienza aquí.'),
('footer_copy','Tours locales, experiencias auténticas y recuerdos que duran para siempre.')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE tour_translations (
  tour_id BIGINT UNSIGNED NOT NULL,
  lang CHAR(2) NOT NULL,
  name VARCHAR(180) NOT NULL,
  destination VARCHAR(160) NOT NULL,
  short_description VARCHAR(320) NULL,
  description TEXT NULL,
  duration VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tour_id, lang),
  KEY idx_tour_translations_lang (lang),
  CONSTRAINT fk_tour_translations_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT chk_tour_translations_lang CHECK (lang REGEXP '^[a-z]{2}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: existing tours already have canonical ES content; copy it into translations.
INSERT INTO tour_translations (tour_id, lang, name, destination, short_description, description, duration)
SELECT id, 'es', name, destination, short_description, description, duration
FROM tours
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  destination = VALUES(destination),
  short_description = VALUES(short_description),
  description = VALUES(description),
  duration = VALUES(duration);

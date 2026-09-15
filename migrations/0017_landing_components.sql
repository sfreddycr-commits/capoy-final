-- migrations/0017_landing_components.sql
-- Landing visual editor: per-slot, per-breakpoint component table + publication history.
-- NOTE: admin_users.role already exists from migrations/0001_admin_auth.sql (VARCHAR(40)
-- NOT NULL DEFAULT 'admin'). Live taxonomy is 'owner' (id=1) and 'admin' (id=2), as used by
-- server/users.js and src/UsersPage.tsx. The owner-only gate for the editor will read the
-- existing column; no ALTER on admin_users is performed here.

-- 1) Per-slot, per-breakpoint landing components.
--    site_section × slot × breakpoint uniquely identifies a component.
--    props_json holds the currently-published props; draft_props_json holds unpublished edits
--    made in the visual editor (merged into props_json on Publish).
CREATE TABLE IF NOT EXISTS landing_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_section ENUM('header','hero','trust_strip') NOT NULL,
  slot VARCHAR(64) NOT NULL,
  breakpoint ENUM('desktop','tablet','mobile') NOT NULL,
  pos_x INT NOT NULL DEFAULT 0,
  pos_y INT NOT NULL DEFAULT 0,
  width INT NULL,
  height INT NULL,
  z_index INT NOT NULL DEFAULT 1,
  hidden TINYINT(1) NOT NULL DEFAULT 0,
  props_json JSON NOT NULL,
  draft_props_json JSON NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  UNIQUE KEY uniq_slot_bp (site_section, slot, breakpoint),
  KEY idx_section (site_section, slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Append-only publication history: one row per published snapshot, per section.
CREATE TABLE IF NOT EXISTS landing_versions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_section ENUM('header','hero','trust_strip') NOT NULL,
  snapshot_json JSON NOT NULL,
  published_by BIGINT UNSIGNED NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_section_time (site_section, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

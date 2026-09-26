-- Fix double-encoded UTF-8 (mojibake) in capoy_db.
--
-- Cause: UTF-8 text was inserted through a latin1 connection, so e.g. 'á'
-- (bytes c3 a1) was stored double-encoded as 'Ã¡' (c3 83 c2 a1). Re-encoding
-- the stored value through latin1 -> binary -> utf8mb4 restores the original
-- bytes.
--
-- Safety:
--   * Only rows that actually contain the mojibake byte signature are touched:
--       'C383'     = 'Ã'  (accented-text mojibake)
--       'C3B0C5B8' = 'ðŸ' (emoji mojibake)
--   * Rows that already contain correct UTF-8 (e.g. cta_title = '¿Listo...',
--     footer_copy = '...auténticas') are intentionally NOT touched: a blind
--     reshape would turn their valid accented bytes into U+FFFD.
--   * `CAST(... AS BINARY)` is used because MySQL 8.0 removed the
--     `CONVERT(... USING binary)` form.
--
-- Scope was verified by scanning every varchar/text column in capoy_db for the
-- mojibake signature: only cms_settings.setting_value was affected.

USE capoy_db;

UPDATE cms_settings
SET setting_value = CONVERT(CAST(CONVERT(setting_value USING latin1) AS BINARY) USING utf8mb4)
WHERE HEX(setting_value) LIKE '%C383%' OR HEX(setting_value) LIKE '%C3B0C5B8%';

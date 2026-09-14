-- 0016_tour_featured_sort.sql
-- Tours 100% dinámicos: destacado + orden de prioridad
-- featured   -> TINYINT(1) (0/1), mostrado primero en public/admin
-- sort_order -> INT nullable, menor valor = antes (null = último)
-- No requiere toolchain; respaldar antes de aplicar.

ALTER TABLE tours
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN sort_order INT NULL DEFAULT NULL AFTER featured;

CREATE INDEX idx_tours_featured_sort ON tours (featured, sort_order);
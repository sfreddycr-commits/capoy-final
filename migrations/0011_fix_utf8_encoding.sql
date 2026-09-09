-- Fix double-encoded UTF-8 → utf8mb4 data in capoy_final.
-- The data was inserted with the connection set to latin1 while containing
-- actual UTF-8 bytes, so multi-byte chars like 'á' (c3 a1) were stored as
-- the latin1 'Ã' (c3) followed by '*' (2a) — wrong.
-- This procedure re-encodes them to proper utf8mb4.

USE capoy_final;

-- 1. Convert cms_settings values
UPDATE cms_settings
SET setting_value = CONVERT(CAST(CONVERT(setting_value USING latin1) USING binary) USING utf8mb4)
WHERE setting_value REGEXP '[Ã][¡-¿]' OR setting_value REGEXP '[^[:ascii:]]';

-- 2. Convert app_settings (should be safe but harmless if no data affected)
UPDATE app_settings
SET setting_value = CONVERT(CAST(CONVERT(setting_value USING latin1) USING binary) USING utf8mb4)
WHERE setting_value REGEXP '[Ã][¡-¿]' OR setting_value REGEXP '[^[:ascii:]]';

-- 3. Convert tours (name, destination, description, short_description, duration)
UPDATE tours SET
  name = CONVERT(CAST(CONVERT(name USING latin1) USING binary) USING utf8mb4),
  destination = CONVERT(CAST(CONVERT(destination USING latin1) USING binary) USING utf8mb4),
  short_description = CONVERT(CAST(COALESCE(short_description,'') USING latin1) USING binary) USING utf8mb4),
  description = CONVERT(CAST(COALESCE(description,'') USING latin1) USING binary) USING utf8mb4),
  duration = CONVERT(CAST(COALESCE(duration,'') USING latin1) USING binary) USING utf8mb4)
WHERE
  name REGEXP '[Ã][¡-¿]' OR destination REGEXP '[Ã][¡-¿]';

-- 4. Convert customers
UPDATE customers SET
  full_name = CONVERT(CAST(full_name USING latin1) USING binary) USING utf8mb4),
  email = LOWER(email),
  phone = CONVERT(CAST(COALESCE(phone,'') USING latin1) USING binary) USING utf8mb4),
  country = CONVERT(CAST(COALESCE(country,'') USING latin1) USING binary) USING utf8mb4),
  city = CONVERT(CAST(COALESCE(city,'') USING latin1) USING binary) USING utf8mb4),
  notes = CONVERT(CAST(COALESCE(notes,'') USING latin1) USING binary) USING utf8mb4)
WHERE
  full_name REGEXP '[Ã][¡-¿]' OR full_name REGEXP '[^[:ascii:]]';

-- 5. Convert providers
UPDATE providers SET
  name = CONVERT(CAST(name USING latin1) USING binary) USING utf8mb4),
  contact_name = CONVERT(CAST(COALESCE(contact_name,'') USING latin1) USING binary) USING utf8mb4),
  phone = CONVERT(CAST(COALESCE(phone,'') USING latin1) USING binary) USING utf8mb4),
  email = LOWER(COALESCE(email,'')),
  address = CONVERT(CAST(COALESCE(address,'') USING latin1) USING binary) USING utf8mb4),
  notes = CONVERT(CAST(COALESCE(notes,'') USING latin1) USING binary) USING utf8mb4)
WHERE
  name REGEXP '[Ã][¡-¿]' OR name REGEXP '[^[:ascii:]]';

-- 6. Convert fleet
UPDATE fleet SET
  plate = CONVERT(CAST(COALESCE(plate,'') USING latin1) USING binary) USING utf8mb4),
  brand = CONVERT(CAST(brand USING latin1) USING binary) USING utf8mb4),
  model = CONVERT(CAST(model USING latin1) USING binary) USING utf8mb4),
  capacity_label = CONVERT(CAST(COALESCE(capacity_label,'') USING latin1) USING binary) USING utf8mb4),
  driver_name = CONVERT(CAST(COALESCE(driver_name,'') USING latin1) USING binary) USING utf8mb4),
  driver_phone = CONVERT(CAST(COALESCE(driver_phone,'') USING latin1) USING binary) USING utf8mb4),
  notes = CONVERT(CAST(COALESCE(notes,'') USING latin1) USING binary) USING utf8mb4)
WHERE
  brand REGEXP '[Ã][¡-¿]' OR brand REGEXP '[^[:ascii:]]';

-- 7. Convert reviews (author_name, author_country, title, body)
UPDATE reviews SET
  author_name = CONVERT(CAST(author_name USING latin1) USING binary) USING utf8mb4),
  author_country = CONVERT(CAST(COALESCE(author_country,'') USING latin1) USING binary) USING utf8mb4),
  title = CONVERT(CAST(COALESCE(title,'') USING latin1) USING binary) USING utf8mb4),
  body = CONVERT(CAST(body USING latin1) USING binary) USING utf8mb4)
WHERE
  author_name REGEXP '[Ã][¡-¿]' OR author_name REGEXP '[^[:ascii:]]';

-- 8. Convert reservations (customer_name, notes)
UPDATE reservations SET
  customer_name = CONVERT(CAST(customer_name USING latin1) USING binary) USING utf8mb4),
  notes = CONVERT(CAST(COALESCE(notes,'') USING latin1) USING binary) USING utf8mb4)
WHERE
  customer_name REGEXP '[Ã][¡-¿]' OR customer_name REGEXP '[^[:ascii:]]';

-- 9. Convert admin_users (display_name, email)
UPDATE admin_users SET
  display_name = CONVERT(CAST(display_name USING latin1) USING binary) USING utf8mb4)
WHERE
  display_name REGEXP '[Ã][¡-¿]' OR display_name REGEXP '[^[:ascii:]]';

-- 10. Fix specific known broken values in this environment
-- (manual backup: hero_lead and cta_copy from the baseline)
UPDATE cms_settings SET setting_value = 'Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país.' WHERE setting_key = 'hero_lead';
UPDATE cms_settings SET setting_value = 'Reserva hoy y vive Costa Rica como nunca antes. Tu mejor historia comienza aquí.' WHERE setting_key = 'cta_copy';
UPDATE cms_settings SET setting_value = 'Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país. ¡Contáctanos!' WHERE setting_key = 'hero_title' AND setting_value NOT LIKE '%Costa Rica como nunca antes%';

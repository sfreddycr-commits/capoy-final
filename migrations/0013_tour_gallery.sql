-- Tour gallery: up to 10 image URLs per tour + a separate `watermarked_gallery`
-- JSON column that holds the cached post-watermark URLs (rendered by the server
-- when an admin uploads images). Both stored as TEXT JSON array.

ALTER TABLE tours
  ADD COLUMN gallery_images JSON NULL AFTER main_image_url,
  ADD COLUMN gallery_watermarked JSON NULL AFTER gallery_images;

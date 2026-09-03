ALTER TABLE reservations
  ADD COLUMN customer_id BIGINT UNSIGNED NULL AFTER customer_phone,
  ADD KEY idx_reservations_customer_id (customer_id),
  ADD CONSTRAINT fk_reservations_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE SET NULL;

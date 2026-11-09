-- Store a payment preference; no funds are captured at checkout.
ALTER TABLE orders ADD COLUMN preferred_payment_method TEXT NOT NULL DEFAULT 'unspecified'
  CHECK (preferred_payment_method IN ('unspecified','paypal','bank','western_union','moneygram'));

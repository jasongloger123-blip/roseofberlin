-- Price snapshots are immutable, including for future import adapters.
CREATE TRIGGER order_items_immutable
BEFORE UPDATE ON order_items
BEGIN
  SELECT RAISE(ABORT, 'order_item_snapshot_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER order_subtotal_immutable
BEFORE UPDATE OF subtotal_cents, currency ON orders
WHEN NEW.subtotal_cents != OLD.subtotal_cents OR NEW.currency != OLD.currency
BEGIN
  SELECT RAISE(ABORT, 'order_price_snapshot_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER order_items_validate
BEFORE INSERT ON order_items
WHEN typeof(NEW.quantity) != 'integer' OR NEW.quantity < 1 OR NEW.quantity > 5
 OR typeof(NEW.unit_price_cents) != 'integer' OR NEW.unit_price_cents <= 0
 OR NEW.line_total_cents != NEW.unit_price_cents * NEW.quantity
BEGIN
  SELECT RAISE(ABORT, 'invalid_order_item');
END;
--> statement-breakpoint
CREATE TRIGGER orders_validate_totals
BEFORE UPDATE OF shipping_cents, total_cents ON orders
WHEN (NEW.shipping_cents IS NULL AND NEW.total_cents IS NOT NULL)
 OR (NEW.shipping_cents IS NOT NULL AND (typeof(NEW.shipping_cents) != 'integer' OR NEW.shipping_cents < 0 OR NEW.shipping_cents > 100000 OR NEW.total_cents IS NULL OR NEW.total_cents != NEW.subtotal_cents + NEW.shipping_cents))
BEGIN
  SELECT RAISE(ABORT, 'invalid_order_total');
END;

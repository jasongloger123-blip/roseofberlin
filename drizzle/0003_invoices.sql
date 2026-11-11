CREATE TABLE `invoice_archive` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`label` text NOT NULL,
	`content` text NOT NULL,
	`imported_at` text NOT NULL,
	`imported_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_archive_fingerprint_unique` ON `invoice_archive` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `invoice_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	CONSTRAINT "invoice_settings_singleton" CHECK("invoice_settings"."id"=1)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`number` text,
	`order_id` text NOT NULL,
	`token` text NOT NULL,
	`snapshot` text NOT NULL,
	`issued_at` text NOT NULL,
	`issued_by` text NOT NULL,
	`cancelled_at` text,
	`cancelled_by` text,
	`cancellation_reason` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_id_unique` ON `invoices` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_token_unique` ON `invoices` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_one_active_per_order` ON `invoices` (`order_id`) WHERE "invoices"."cancelled_at" IS NULL;--> statement-breakpoint
CREATE TRIGGER invoices_immutable BEFORE UPDATE OF id,order_id,token,snapshot,issued_at,issued_by ON invoices BEGIN SELECT RAISE(ABORT,'invoice_snapshot_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER invoices_no_delete BEFORE DELETE ON invoices BEGIN SELECT RAISE(ABORT,'invoice_cannot_be_deleted'); END;
--> statement-breakpoint
CREATE TRIGGER invoices_number_immutable BEFORE UPDATE OF number ON invoices WHEN OLD.number IS NOT NULL BEGIN SELECT RAISE(ABORT,'invoice_number_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER invoiced_order_terms_locked BEFORE UPDATE OF shipping_cents,availability_confirmed ON orders WHEN (NEW.shipping_cents IS NOT OLD.shipping_cents OR NEW.availability_confirmed != OLD.availability_confirmed) AND EXISTS(SELECT 1 FROM invoices WHERE order_id=OLD.id AND cancelled_at IS NULL) BEGIN SELECT RAISE(ABORT,'invoice_terms_locked'); END;

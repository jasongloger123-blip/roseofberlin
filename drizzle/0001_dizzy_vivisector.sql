CREATE TABLE `order_email_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`outcome` text NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `order_email_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_email_attempts_event_id_idx` ON `order_email_attempts` (`event_id`);--> statement-breakpoint
CREATE TABLE `order_email_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload_json` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`first_attempt_at` text,
	`last_attempt_at` text,
	`lease_id` text,
	`lease_until` text,
	`provider_id` text,
	`error_code` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_email_events_dedupe_key_unique` ON `order_email_events` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `order_email_events_order_id_idx` ON `order_email_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_key` text NOT NULL,
	`product_label` text NOT NULL,
	`size` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`order_number` text,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`public_token` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`address_line1` text NOT NULL,
	`address_line2` text,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`language` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer,
	`total_cents` integer,
	`status` text DEFAULT 'received' NOT NULL,
	`availability_confirmed` integer DEFAULT 0 NOT NULL,
	`seller_note` text DEFAULT '' NOT NULL,
	`tracking_number` text,
	`payment_revision` integer DEFAULT 0 NOT NULL,
	`payment_snapshot` text,
	`payment_requested_at` text,
	`paid_at` text,
	`shipped_at` text,
	`source` text DEFAULT 'website' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`mutation_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_id_unique` ON `orders` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_public_token_unique` ON `orders` (`public_token`);--> statement-breakpoint
CREATE INDEX `orders_status_sequence_idx` ON `orders` (`status`,`sequence`);
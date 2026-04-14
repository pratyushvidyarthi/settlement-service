CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`user_id` text NOT NULL,
	`base_fare_cents` integer NOT NULL,
	`usage_overage_cents` integer NOT NULL,
	`late_fee_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`pre_auth_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`gateway_charge_id` text,
	`failure_reason` text,
	`gateway_raw_response` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlements_booking_id_unique` ON `settlements` (`booking_id`);
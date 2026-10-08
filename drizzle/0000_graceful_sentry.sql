CREATE TABLE `research_leases` (
	`name` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_quotas` (
	`bucket` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_research_quotas_expiry` ON `research_quotas` (`expires_at`);
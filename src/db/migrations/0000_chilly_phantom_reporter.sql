CREATE TABLE `anime_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mal_id` integer NOT NULL,
	`title` text NOT NULL,
	`title_english` text,
	`title_japanese` text,
	`image_url` text,
	`rating` real,
	`premiere_date` text,
	`num_episodes` integer,
	`episode_duration` integer,
	`anime_type` text DEFAULT 'unknown' NOT NULL,
	`status` text,
	`source` text,
	`studios` text,
	`genres` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `anime_relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_mal_id` integer NOT NULL,
	`target_mal_id` integer NOT NULL,
	`relationship_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`source_mal_id`) REFERENCES `anime_info`(`mal_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_mal_id`) REFERENCES `anime_info`(`mal_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timeline_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`root_mal_id` integer NOT NULL,
	`timeline_data` text NOT NULL,
	`cache_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `user_watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_info_id` integer NOT NULL,
	`priority` integer NOT NULL,
	`watch_status` text DEFAULT 'plan_to_watch' NOT NULL,
	`user_rating` real,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`anime_info_id`) REFERENCES `anime_info`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_info_mal_id_unique` ON `anime_info` (`mal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `timeline_cache_root_mal_id_unique` ON `timeline_cache` (`root_mal_id`);
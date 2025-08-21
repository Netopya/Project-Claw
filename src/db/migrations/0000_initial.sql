CREATE TABLE `anime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mal_id` integer NOT NULL,
	`title` text NOT NULL,
	`title_english` text,
	`title_japanese` text,
	`image_url` text,
	`rating` real,
	`premiere_date` text,
	`num_episodes` integer,
	`series_info` text,
	`priority` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `anime_mal_id_unique` ON `anime` (`mal_id`);
CREATE INDEX `idx_anime_priority` ON `anime` (`priority`);
CREATE INDEX `idx_anime_mal_id` ON `anime` (`mal_id`);
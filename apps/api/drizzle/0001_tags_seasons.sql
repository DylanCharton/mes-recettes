CREATE TABLE `recipe_season` (
	`recipe_id` integer NOT NULL,
	`season` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `season`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_season_season_check" CHECK("recipe_season"."season" in ('spring', 'summer', 'autumn', 'winter'))
);
--> statement-breakpoint
CREATE INDEX `recipe_season_season_idx` ON `recipe_season` (`season`);--> statement-breakpoint
CREATE TABLE `recipe_tag` (
	`recipe_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_tag_tag_id_idx` ON `recipe_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_normalizedName_unique` ON `tag` (`normalized_name`);
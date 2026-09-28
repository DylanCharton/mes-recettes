CREATE TABLE `ingredient` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_normalizedName_unique` ON `ingredient` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`ingredient_id` integer,
	`position` integer NOT NULL,
	`quantity` real,
	`unit` text,
	`name` text NOT NULL,
	`original_text` text NOT NULL,
	`is_optional` integer DEFAULT false NOT NULL,
	`is_pantry` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredient_recipe_id_idx` ON `recipe_ingredient` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_ingredient_id_idx` ON `recipe_ingredient` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `recipe_step` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_step_recipe_id_idx` ON `recipe_step` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`servings` integer DEFAULT 2 NOT NULL,
	`servings_label` text,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`total_minutes` integer,
	`difficulty` integer,
	`status` text DEFAULT 'to_try' NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`notes` text,
	`tools` text,
	`nutrition` text,
	`nutri_score` text,
	`green_score` text,
	`cuisine` text,
	`image_path` text,
	`image_source_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_url` text,
	`external_id` text,
	`source_payload` text,
	`search_text` text NOT NULL,
	`imported_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_source_external_id_idx` ON `recipe` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `recipe_source_url_idx` ON `recipe` (`source_url`);--> statement-breakpoint
CREATE INDEX `recipe_status_idx` ON `recipe` (`status`);--> statement-breakpoint
CREATE INDEX `recipe_is_favorite_idx` ON `recipe` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `recipe_total_minutes_idx` ON `recipe` (`total_minutes`);--> statement-breakpoint
CREATE INDEX `recipe_created_at_idx` ON `recipe` (`created_at`);
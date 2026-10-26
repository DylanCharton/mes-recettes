CREATE TABLE `invitation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`used_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_tokenHash_unique` ON `invitation` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invitation_created_by_idx` ON `invitation` (`created_by`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text,
	`name` text NOT NULL,
	`password_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
-- Écrit à la main (drizzle-kit propose un ADD COLUMN NOT NULL, impossible sur des tables remplies).
-- Le compte n° 1 reçoit toute la bibliothèque existante ; e-mail et mot de passe sont posés au
-- premier démarrage (ADMIN_EMAIL + AUTH_PASSWORD_HASH). Les migrations s'exécutent clés
-- étrangères désactivées (db/client.ts) : supprimer `recipe` ne supprime donc pas ses enfants.
INSERT INTO `user` (`id`, `name`, `is_admin`) VALUES (1, 'dylan', true);
--> statement-breakpoint
CREATE TABLE `__new_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tag` (`id`, `user_id`, `name`, `normalized_name`, `created_at`)
SELECT `id`, 1, `name`, `normalized_name`, `created_at` FROM `tag`;
--> statement-breakpoint
DROP TABLE `tag`;
--> statement-breakpoint
ALTER TABLE `__new_tag` RENAME TO `tag`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_user_normalized_name_unique` ON `tag` (`user_id`,`normalized_name`);
--> statement-breakpoint
CREATE TABLE `__new_recipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
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
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recipe` (`user_id`, `id`, `title`, `description`, `servings`, `servings_label`, `prep_minutes`, `cook_minutes`, `total_minutes`, `difficulty`, `status`, `is_favorite`, `notes`, `tools`, `nutrition`, `nutri_score`, `green_score`, `cuisine`, `image_path`, `image_source_url`, `source`, `source_url`, `external_id`, `source_payload`, `search_text`, `imported_at`, `created_at`, `updated_at`)
SELECT 1, `id`, `title`, `description`, `servings`, `servings_label`, `prep_minutes`, `cook_minutes`, `total_minutes`, `difficulty`, `status`, `is_favorite`, `notes`, `tools`, `nutrition`, `nutri_score`, `green_score`, `cuisine`, `image_path`, `image_source_url`, `source`, `source_url`, `external_id`, `source_payload`, `search_text`, `imported_at`, `created_at`, `updated_at` FROM `recipe`;
--> statement-breakpoint
DROP TABLE `recipe`;
--> statement-breakpoint
ALTER TABLE `__new_recipe` RENAME TO `recipe`;
--> statement-breakpoint
CREATE INDEX `recipe_user_id_idx` ON `recipe` (`user_id`);--> statement-breakpoint
CREATE INDEX `recipe_source_external_id_idx` ON `recipe` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `recipe_source_url_idx` ON `recipe` (`source_url`);--> statement-breakpoint
CREATE INDEX `recipe_status_idx` ON `recipe` (`status`);--> statement-breakpoint
CREATE INDEX `recipe_is_favorite_idx` ON `recipe` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `recipe_total_minutes_idx` ON `recipe` (`total_minutes`);--> statement-breakpoint
CREATE INDEX `recipe_created_at_idx` ON `recipe` (`created_at`);

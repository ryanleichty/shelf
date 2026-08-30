CREATE TABLE `collections` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `tmdb_collection_id` text,
  `overview` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_tmdb_collection_id_unique`
  ON `collections` (`tmdb_collection_id`);
--> statement-breakpoint
CREATE TABLE `item_collections` (
  `item_id` integer NOT NULL REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
  `collection_id` integer NOT NULL REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_collections_item_id_unique`
  ON `item_collections` (`item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_collections_item_id_collection_id_unique`
  ON `item_collections` (`item_id`, `collection_id`);

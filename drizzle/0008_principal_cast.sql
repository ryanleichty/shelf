CREATE TABLE `actors` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actors_slug_unique` ON `actors` (`slug`);
--> statement-breakpoint
CREATE TABLE `item_actors` (
  `item_id` integer NOT NULL REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
  `actor_id` integer NOT NULL REFERENCES `actors`(`id`) ON UPDATE no action ON DELETE cascade,
  `position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_actors_item_id_actor_id_unique`
  ON `item_actors` (`item_id`, `actor_id`);

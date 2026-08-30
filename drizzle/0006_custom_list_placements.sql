ALTER TABLE `lists` ADD `system` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `lists` SET `system` = true WHERE `slug` IN ('watchlist', 'reading-list');
--> statement-breakpoint
CREATE TABLE `list_placements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `list_id` integer REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
  `kind` text NOT NULL,
  `type` text NOT NULL,
  `position` integer NOT NULL,
  `visible` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_placements_list_id_type_unique`
  ON `list_placements` (`list_id`, `type`);
--> statement-breakpoint
INSERT INTO `list_placements` (`list_id`, `type`, `position`, `visible`)
SELECT `id`, 'list', 'book', 1, true FROM `lists` WHERE `slug` = 'reading-list';
--> statement-breakpoint
INSERT INTO `list_placements` (`list_id`, `type`, `position`, `visible`)
SELECT `id`, 'list', 'movie', 1, true FROM `lists` WHERE `slug` = 'watchlist';
--> statement-breakpoint
INSERT INTO `list_placements` (`list_id`, `type`, `position`, `visible`)
SELECT `id`, 'list', 'tv', 1, true FROM `lists` WHERE `slug` = 'watchlist';
--> statement-breakpoint
INSERT INTO `list_placements` (`list_id`, `kind`, `type`, `position`, `visible`)
VALUES (NULL, 'recent', 'book', 0, true), (NULL, 'recent', 'movie', 0, true), (NULL, 'recent', 'tv', 0, true);

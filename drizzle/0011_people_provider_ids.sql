ALTER TABLE `authors` ADD `open_library_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_open_library_key_unique` ON `authors` (`open_library_key`);
--> statement-breakpoint
ALTER TABLE `directors` ADD `tmdb_person_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `directors_tmdb_person_id_unique` ON `directors` (`tmdb_person_id`);
--> statement-breakpoint
ALTER TABLE `actors` ADD `tmdb_person_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `actors_tmdb_person_id_unique` ON `actors` (`tmdb_person_id`);

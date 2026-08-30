ALTER TABLE `list_placements` ADD `source_slug` text;
--> statement-breakpoint
UPDATE `list_placements`
SET `source_slug` = CASE
  WHEN `kind` = 'recent' THEN 'recent'
  ELSE COALESCE((SELECT `slug` FROM `lists` WHERE `lists`.`id` = `list_placements`.`list_id`), '')
END;
--> statement-breakpoint
CREATE UNIQUE INDEX `list_placements_type_kind_source_slug_unique`
  ON `list_placements` (`type`, `kind`, `source_slug`);
--> statement-breakpoint
INSERT INTO `list_placements` (`list_id`, `kind`, `source_slug`, `type`, `position`, `visible`)
SELECT
  NULL,
  'genre',
  `slug`,
  `type`,
  `max_position` + ROW_NUMBER() OVER (PARTITION BY `type` ORDER BY `name`, `slug`),
  true
FROM (
  SELECT DISTINCT
    `genres`.`slug` AS `slug`,
    `genres`.`name` AS `name`,
    `items`.`type` AS `type`,
    COALESCE((
      SELECT MAX(`position`)
      FROM `list_placements` AS `placements`
      WHERE `placements`.`type` = `items`.`type`
    ), -1) AS `max_position`
  FROM `item_genres`
  INNER JOIN `genres` ON `item_genres`.`genre_id` = `genres`.`id`
  INNER JOIN `items` ON `item_genres`.`item_id` = `items`.`id`
);

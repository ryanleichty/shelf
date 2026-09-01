UPDATE `list_placements`
SET `position` = `position` + 1
WHERE EXISTS (
  SELECT 1
  FROM `list_placements` AS `system_placement`
  INNER JOIN `lists` ON `lists`.`id` = `system_placement`.`list_id`
  WHERE `system_placement`.`type` = `list_placements`.`type`
    AND `system_placement`.`id` != `list_placements`.`id`
    AND `list_placements`.`position` < `system_placement`.`position`
    AND (
      (`system_placement`.`type` = 'book' AND `lists`.`slug` = 'reading-list')
      OR (`system_placement`.`type` IN ('movie', 'tv') AND `lists`.`slug` = 'watchlist')
    )
);
--> statement-breakpoint
UPDATE `list_placements`
SET `position` = 0
WHERE `id` IN (
  SELECT `system_placement`.`id`
  FROM `list_placements` AS `system_placement`
  INNER JOIN `lists` ON `lists`.`id` = `system_placement`.`list_id`
  WHERE (`system_placement`.`type` = 'book' AND `lists`.`slug` = 'reading-list')
    OR (`system_placement`.`type` IN ('movie', 'tv') AND `lists`.`slug` = 'watchlist')
);

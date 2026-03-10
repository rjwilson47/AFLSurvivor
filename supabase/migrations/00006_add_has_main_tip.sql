-- Add has_main_tip column to rounds table
-- Rounds with has_main_tip = false (e.g. Round 0) have no main tip requirement:
--   - Regular tips are still submitted and scored
--   - Idol earning still applies (all regular tips correct)
--   - No life loss (no main tip to be wrong)
--   - No default main tip assignment

ALTER TABLE rounds ADD COLUMN has_main_tip boolean NOT NULL DEFAULT true;

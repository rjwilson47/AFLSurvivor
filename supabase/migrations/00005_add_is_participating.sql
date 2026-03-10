-- Migration 00005: Add is_participating column to participants
-- Allows admins (e.g. Mike Lee) to be in the system but not on the leaderboard.

ALTER TABLE participants
ADD COLUMN is_participating boolean NOT NULL DEFAULT true;

-- Update the participants_public view to include is_participating
CREATE OR REPLACE VIEW participants_public AS
SELECT
  id,
  user_id,
  season_id,
  display_name,
  lives_total,
  lives_remaining,
  is_eliminated,
  is_active,
  is_participating,
  joined_at
FROM participants;

-- AFL Survivor Pool — Core Schema
-- Migration 00001: Tables, enums, constraints, indexes

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE participant_role AS ENUM ('participant', 'admin', 'superadmin');
CREATE TYPE match_result AS ENUM ('home_win', 'away_win', 'draw', 'pending');

-- =============================================================================
-- TABLES
-- =============================================================================

-- Static table: seeded once with all 18 AFL teams
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,        -- e.g. "Richmond Tigers"
  short_name text NOT NULL UNIQUE,  -- e.g. "Richmond"
  abbreviation text NOT NULL UNIQUE -- e.g. "RIC"
);

CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  entry_cost int NOT NULL DEFAULT 0,
  extra_life_cost int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active season at a time
CREATE UNIQUE INDEX idx_seasons_one_active ON seasons (is_active) WHERE is_active = true;

CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  lives_total int NOT NULL DEFAULT 2 CHECK (lives_total BETWEEN 2 AND 3),
  lives_remaining int NOT NULL DEFAULT 2 CHECK (lives_remaining >= 0),
  idol_count int NOT NULL DEFAULT 0 CHECK (idol_count >= 0),
  is_eliminated boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  role participant_role NOT NULL DEFAULT 'participant',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id)
);

CREATE INDEX idx_participants_user_id ON participants (user_id);
CREATE INDEX idx_participants_season_id ON participants (season_id);

CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round_number int NOT NULL CHECK (round_number BETWEEN 0 AND 27),
  deadline timestamptz NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  results_entered boolean NOT NULL DEFAULT false,
  mikes_corner text,
  mikes_corner_posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, round_number)
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  home_team_id uuid NOT NULL REFERENCES teams(id),
  away_team_id uuid NOT NULL REFERENCES teams(id),
  match_datetime timestamptz,
  venue text,
  result match_result NOT NULL DEFAULT 'pending',
  winner_team_id uuid REFERENCES teams(id),
  loser_team_id uuid REFERENCES teams(id),
  is_final_match boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (home_team_id != away_team_id)
);

CREATE INDEX idx_matches_round_id ON matches (round_id);

-- Ensure at most one final match per round
CREATE UNIQUE INDEX idx_matches_one_final_per_round ON matches (round_id) WHERE is_final_match = true;

CREATE TABLE tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  tipped_loser_team_id uuid NOT NULL REFERENCES teams(id),
  is_correct boolean, -- null until scored
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, match_id)
);

CREATE INDEX idx_tips_round_id ON tips (round_id);
CREATE INDEX idx_tips_match_id ON tips (match_id);

CREATE TABLE main_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  tipped_loser_team_id uuid NOT NULL REFERENCES teams(id),
  is_correct boolean, -- null until scored
  idol_played boolean NOT NULL DEFAULT false,
  idol_played_at timestamptz,
  was_default_assigned boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, round_id)
);

CREATE INDEX idx_main_tips_round_id ON main_tips (round_id);

CREATE TABLE main_tip_team_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id),
  times_used int NOT NULL DEFAULT 1 CHECK (times_used BETWEEN 0 AND 2),
  UNIQUE (participant_id, season_id, team_id)
);

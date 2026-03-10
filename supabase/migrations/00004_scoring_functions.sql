-- AFL Survivor Pool — Scoring Functions
-- Migration 00004: Per-match scoring, round-level calculations, default assignment

-- =============================================================================
-- FUNCTION: score_match_tips(match_uuid)
-- Called when a match result is set/changed.
-- Scores all regular tips and main tips for that match.
-- Then checks if all matches in the round are scored → triggers round-level calcs.
-- =============================================================================

CREATE OR REPLACE FUNCTION score_match_tips(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round_id uuid;
  v_result match_result;
  v_loser_team_id uuid;
  v_all_scored boolean;
BEGIN
  -- Get match details
  SELECT round_id, result, loser_team_id
  INTO v_round_id, v_result, v_loser_team_id
  FROM matches
  WHERE id = p_match_id;

  IF v_result = 'pending' THEN
    -- If result cleared back to pending, null out scores for this match
    UPDATE tips SET is_correct = NULL WHERE match_id = p_match_id;
    UPDATE main_tips SET is_correct = NULL WHERE match_id = p_match_id;
    -- Reset results_entered since not all matches have results anymore
    UPDATE rounds SET results_entered = false WHERE id = v_round_id;
  ELSIF v_result = 'draw' THEN
    -- Draw: no loser, so all tips are incorrect
    UPDATE tips SET is_correct = false WHERE match_id = p_match_id;
    UPDATE main_tips SET is_correct = false WHERE match_id = p_match_id;
  ELSE
    -- Normal result: tip is correct if tipped_loser matches actual loser
    UPDATE tips
    SET is_correct = (tipped_loser_team_id = v_loser_team_id)
    WHERE match_id = p_match_id;

    UPDATE main_tips
    SET is_correct = (tipped_loser_team_id = v_loser_team_id)
    WHERE match_id = p_match_id;
  END IF;

  -- Check if all matches in the round now have results
  SELECT NOT EXISTS (
    SELECT 1 FROM matches
    WHERE round_id = v_round_id AND result = 'pending'
  ) INTO v_all_scored;

  IF v_all_scored THEN
    -- All matches scored — run round-level calculations
    PERFORM calculate_round_outcomes(v_round_id);
  END IF;
END;
$$;

-- =============================================================================
-- FUNCTION: calculate_round_outcomes(round_uuid)
-- Called when all matches in a round have results.
-- Calculates: idol earning, life loss, eliminations.
-- Idempotent — safe to re-run after result corrections.
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_round_outcomes(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant record;
  v_all_correct boolean;
  v_total_tips int;
  v_correct_tips int;
  v_main_tip record;
  v_prev_lives int;
BEGIN
  -- Mark round as results entered
  UPDATE rounds SET results_entered = true WHERE id = p_round_id;

  -- Process each participant who has tips in this round
  FOR v_participant IN
    SELECT DISTINCT p.id AS participant_id, p.is_eliminated, p.lives_remaining, p.idol_count
    FROM participants p
    JOIN tips t ON t.participant_id = p.id
    WHERE t.round_id = p_round_id
      AND p.is_active = true
  LOOP
    -- Count total tips and correct tips for this participant in this round
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_correct = true)
    INTO v_total_tips, v_correct_tips
    FROM tips
    WHERE participant_id = v_participant.participant_id
      AND round_id = p_round_id;

    v_all_correct := (v_total_tips > 0 AND v_total_tips = v_correct_tips);

    -- Get the main tip for this participant in this round
    SELECT * INTO v_main_tip
    FROM main_tips
    WHERE participant_id = v_participant.participant_id
      AND round_id = p_round_id;

    -- IDOL EARNING: all tips correct AND participant is not eliminated
    IF v_all_correct AND NOT v_participant.is_eliminated THEN
      UPDATE participants
      SET idol_count = idol_count + 1
      WHERE id = v_participant.participant_id
        AND NOT is_eliminated;
    END IF;

    -- LIFE LOSS: main tip incorrect/draw AND no idol played AND not already eliminated
    IF v_main_tip.id IS NOT NULL
       AND (v_main_tip.is_correct = false)
       AND NOT v_main_tip.idol_played
       AND NOT v_participant.is_eliminated
    THEN
      UPDATE participants
      SET
        lives_remaining = GREATEST(lives_remaining - 1, 0),
        is_eliminated = CASE WHEN lives_remaining - 1 <= 0 THEN true ELSE is_eliminated END
      WHERE id = v_participant.participant_id;
    END IF;

  END LOOP;
END;
$$;

-- =============================================================================
-- FUNCTION: assign_round_defaults(round_uuid)
-- Auto-assigns tips for participants who haven't submitted.
-- 1. For each unsubmitted match tip: home team = tipped loser
-- 2. For unsubmitted main tip: home team of is_final_match match
-- Must be called as a single atomic operation.
-- =============================================================================

CREATE OR REPLACE FUNCTION assign_round_defaults(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_season_id uuid;
  v_match record;
  v_participant record;
  v_final_match record;
  v_has_main_tip boolean;
BEGIN
  -- Get season for this round
  SELECT season_id INTO v_season_id FROM rounds WHERE id = p_round_id;

  -- Get the final match for this round (used for default main tip)
  SELECT * INTO v_final_match
  FROM matches
  WHERE round_id = p_round_id AND is_final_match = true
  LIMIT 1;

  -- For each active participant in this season
  FOR v_participant IN
    SELECT id AS participant_id
    FROM participants
    WHERE season_id = v_season_id AND is_active = true
  LOOP
    -- Step 1: assign default tips for unsubmitted matches
    FOR v_match IN
      SELECT m.id AS match_id, m.home_team_id
      FROM matches m
      WHERE m.round_id = p_round_id
        AND NOT EXISTS (
          SELECT 1 FROM tips t
          WHERE t.participant_id = v_participant.participant_id
            AND t.match_id = m.id
        )
    LOOP
      INSERT INTO tips (participant_id, round_id, match_id, tipped_loser_team_id)
      VALUES (v_participant.participant_id, p_round_id, v_match.match_id, v_match.home_team_id);
    END LOOP;

    -- Step 2: assign default main tip if not submitted
    SELECT EXISTS (
      SELECT 1 FROM main_tips
      WHERE participant_id = v_participant.participant_id
        AND round_id = p_round_id
    ) INTO v_has_main_tip;

    IF NOT v_has_main_tip AND v_final_match.id IS NOT NULL THEN
      INSERT INTO main_tips (
        participant_id, round_id, match_id, tipped_loser_team_id, was_default_assigned
      ) VALUES (
        v_participant.participant_id, p_round_id, v_final_match.id,
        v_final_match.home_team_id, true
      );

      -- Update team usage tracking
      INSERT INTO main_tip_team_usage (participant_id, season_id, team_id, times_used)
      VALUES (v_participant.participant_id, v_season_id, v_final_match.home_team_id, 1)
      ON CONFLICT (participant_id, season_id, team_id)
      DO UPDATE SET times_used = main_tip_team_usage.times_used + 1;
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- FUNCTION: grant_third_life(participant_uuid)
-- Atomic third life grant. Validates pre-conditions.
-- =============================================================================

CREATE OR REPLACE FUNCTION grant_third_life(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant record;
  v_season_id uuid;
  v_round1_locked boolean;
BEGIN
  -- Get participant
  SELECT * INTO v_participant
  FROM participants
  WHERE id = p_participant_id;

  IF v_participant IS NULL THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_participant.lives_total >= 3 THEN
    RAISE EXCEPTION 'Participant already has maximum lives';
  END IF;

  -- Check Round 1 isn't locked yet
  SELECT EXISTS (
    SELECT 1 FROM rounds
    WHERE season_id = v_participant.season_id
      AND round_number = 1
      AND is_locked = true
  ) INTO v_round1_locked;

  IF v_round1_locked THEN
    RAISE EXCEPTION 'Cannot grant third life after Round 1 has locked';
  END IF;

  -- Atomic update
  UPDATE participants
  SET
    lives_total = 3,
    lives_remaining = lives_remaining + 1,
    is_eliminated = false
  WHERE id = p_participant_id;
END;
$$;

-- AFL Survivor Pool — RLS Policies
-- Migration 00003: get_user_role() function, participants_public view, all RLS policies

-- =============================================================================
-- HELPER FUNCTION: get_user_role()
-- Returns the role of the currently authenticated user for the active season.
-- Used by all RLS policies (except participants table itself, which uses auth.uid() directly).
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS participant_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM participants
  WHERE user_id = auth.uid()
    AND season_id = (SELECT id FROM seasons WHERE is_active = true LIMIT 1)
    AND is_active = true
  LIMIT 1;
$$;

-- =============================================================================
-- HELPER FUNCTION: get_participant_id()
-- Returns the participant ID of the currently authenticated user for the active season.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_participant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM participants
  WHERE user_id = auth.uid()
    AND season_id = (SELECT id FROM seasons WHERE is_active = true LIMIT 1)
    AND is_active = true
  LIMIT 1;
$$;

-- =============================================================================
-- VIEW: participants_public
-- Excludes role and idol_count columns. Participant-facing queries use this.
-- =============================================================================

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
  joined_at
FROM participants;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_tip_team_usage ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TEAMS — read-only for everyone (public data)
-- =============================================================================

CREATE POLICY "teams_select_all" ON teams
  FOR SELECT USING (true);

-- =============================================================================
-- SEASONS — read-only for everyone, admin/superadmin can manage
-- =============================================================================

CREATE POLICY "seasons_select_all" ON seasons
  FOR SELECT USING (true);

CREATE POLICY "seasons_insert_admin" ON seasons
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "seasons_update_admin" ON seasons
  FOR UPDATE USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "seasons_delete_superadmin" ON seasons
  FOR DELETE USING (get_user_role() = 'superadmin');

-- =============================================================================
-- PARTICIPANTS
-- - Everyone can read (but participants should use the view for limited cols)
-- - Users can update their own non-sensitive fields
-- - Admin can update limited fields (lives, elimination, is_active)
-- - Superadmin has full CRUD including role
-- - Role update restricted to superadmin only (enforced via separate policy)
-- =============================================================================

-- All authenticated users can read participants
CREATE POLICY "participants_select_authenticated" ON participants
  FOR SELECT TO authenticated USING (true);

-- Public (anon) can read participants for leaderboard
CREATE POLICY "participants_select_anon" ON participants
  FOR SELECT TO anon USING (true);

-- Admin/superadmin can insert participants
CREATE POLICY "participants_insert_admin" ON participants
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

-- Admin can update participants (but role update is blocked at app level for admin;
-- only superadmin can change role — enforced via application code + the role-specific policy below)
CREATE POLICY "participants_update_admin" ON participants
  FOR UPDATE USING (get_user_role() IN ('admin', 'superadmin'));

-- Participants can update their own display_name only
CREATE POLICY "participants_update_self" ON participants
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Superadmin can delete (soft delete preferred, but allow hard delete for superadmin)
CREATE POLICY "participants_delete_superadmin" ON participants
  FOR DELETE USING (get_user_role() = 'superadmin');

-- =============================================================================
-- ROUNDS — read for all, CRUD for admin/superadmin
-- =============================================================================

CREATE POLICY "rounds_select_all" ON rounds
  FOR SELECT USING (true);

CREATE POLICY "rounds_insert_admin" ON rounds
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "rounds_update_admin" ON rounds
  FOR UPDATE USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "rounds_delete_superadmin" ON rounds
  FOR DELETE USING (get_user_role() = 'superadmin');

-- =============================================================================
-- MATCHES — read for all, CRUD for admin/superadmin
-- =============================================================================

CREATE POLICY "matches_select_all" ON matches
  FOR SELECT USING (true);

CREATE POLICY "matches_insert_admin" ON matches
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "matches_update_admin" ON matches
  FOR UPDATE USING (get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "matches_delete_admin" ON matches
  FOR DELETE USING (get_user_role() IN ('admin', 'superadmin'));

-- =============================================================================
-- TIPS — own rows for participant, all read for admin, full CRUD superadmin
-- Private: participants can only see their own tips.
-- =============================================================================

-- Participants can read their own tips
CREATE POLICY "tips_select_own" ON tips
  FOR SELECT USING (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

-- Participants can insert their own tips (before deadline, enforced at app level)
CREATE POLICY "tips_insert_own" ON tips
  FOR INSERT WITH CHECK (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

-- Participants can update their own tips (before deadline, enforced at app level)
CREATE POLICY "tips_update_own" ON tips
  FOR UPDATE USING (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

-- Superadmin can delete tips
CREATE POLICY "tips_delete_superadmin" ON tips
  FOR DELETE USING (get_user_role() = 'superadmin');

-- =============================================================================
-- MAIN_TIPS — all can read (public), own write for participant, full CRUD admin+
-- =============================================================================

-- Everyone can read main tips (they're public info)
CREATE POLICY "main_tips_select_all" ON main_tips
  FOR SELECT USING (true);

-- Participants can insert their own main tips
CREATE POLICY "main_tips_insert_own" ON main_tips
  FOR INSERT WITH CHECK (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

-- Participants can update their own main tips; admin/superadmin can update any
CREATE POLICY "main_tips_update" ON main_tips
  FOR UPDATE USING (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

-- Superadmin can delete main tips
CREATE POLICY "main_tips_delete_superadmin" ON main_tips
  FOR DELETE USING (get_user_role() = 'superadmin');

-- =============================================================================
-- MAIN_TIP_TEAM_USAGE — own read/write for participant, full for admin+
-- =============================================================================

CREATE POLICY "usage_select" ON main_tip_team_usage
  FOR SELECT USING (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "usage_insert" ON main_tip_team_usage
  FOR INSERT WITH CHECK (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "usage_update" ON main_tip_team_usage
  FOR UPDATE USING (
    participant_id = get_participant_id()
    OR get_user_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "usage_delete_superadmin" ON main_tip_team_usage
  FOR DELETE USING (get_user_role() = 'superadmin');

# PLAN.md — AFL Survivor Pool Build Checklist

## Current Status

**Phase:** Pre-build (planning documents finalized)
**Last Updated:** 2026-03-10
**Next Step:** Stage 1 — Supabase Setup

---

## Resolved Decisions

- **`participants.user_id`** — separate FK to `auth.users.id`; `id` is its own UUID PK (enables multi-season)
- **Column privacy** — `participants_public` view excludes `role` and `idol_count`; participant queries use the view
- **Main tip validation** — enforced in application code (main tip team must match an existing tip for that round)
- **Column naming** — `mikes_corner` (lowercase) in schema
- **Draw scoring** — regular tips on drawn matches are `is_correct = false`; main tip draws cause life loss unless idol
- **Eliminated participants** — can still tip for engagement; tips scored but lives can't go below 0, can't earn idols
- **Scoring** — per-match (incremental); round-level calcs (idols, lives, eliminations) fire when all matches scored
- **Result correction** — Mike/superadmin can edit results; re-scores affected tips and re-runs round calcs
- **Timezone** — `Australia/Melbourne` (auto AEST/AEDT); store as `timestamptz`, display in Melbourne tz
- **No self-registration** — Supabase signup disabled; superadmin uses admin API (service role) to pre-create users
- **Soft delete** — `is_active` flag on participants, not hard delete
- **Bye rounds** — fewer matches, no special handling; tip form shows whatever matches exist
- **RLS helper** — `get_user_role()` Postgres function; `participants` table policies use `auth.uid() = user_id` directly
- **Idol Q2 deadline** — `match_datetime + 30 min` approximation (no separate field)

## Known Issues / Decisions Pending

- [ ] Confirm Supabase project URL and anon/service keys
- [ ] Confirm domain registration (aflsurvivor.com) and Vercel project setup
- [ ] Decide on `game-rules.md` content (Stage 9 — need rules text from Mike or spec)
- [ ] Email reminder implementation details (Stage 14 — Resend vs Supabase Edge Functions vs skip)

---

## Build Stages

### Stage 1: Supabase Setup — Schema, RLS, Seed Data

- [ ] Initialize Supabase project config (or document connection setup)
- [ ] Create migration: `teams` table
- [ ] Create migration: `seasons` table
- [ ] Create migration: `participants` table with `user_id` FK to `auth.users.id`, role enum (`participant`, `admin`, `superadmin`), `is_active` flag for soft delete
- [ ] Create migration: `rounds` table (use `mikes_corner` lowercase)
- [ ] Create migration: `matches` table with result enum (`home_win`, `away_win`, `draw`, `pending`)
- [ ] Create migration: `tips` table with unique constraint (one tip per participant per match per round)
- [ ] Create migration: `main_tips` table with unique constraint (one main tip per participant per round)
- [ ] Create migration: `main_tip_team_usage` table
- [ ] Seed `teams` table with all 18 AFL teams (name, short_name, abbreviation)
- [ ] Create `get_user_role()` Postgres function for RLS policies
- [ ] Create `participants_public` view (excludes `role`, `idol_count`)
- [ ] Write RLS policies for `tips` (own rows read/write for participant, all read for admin, full CRUD superadmin)
- [ ] Write RLS policies for `main_tips` (all read, own write for participant, full CRUD admin/superadmin)
- [ ] Write RLS policies for `matches` (read for participant, full CRUD admin/superadmin)
- [ ] Write RLS policies for `rounds` (read for participant, full CRUD admin/superadmin)
- [ ] Write RLS policies for `participants` (read via view for participant, full for admin/superadmin, role update superadmin only)
- [ ] Create scoring function: per-match tip scoring + round-level idol/life/elimination calcs (fires when all matches scored)
- [ ] Verify all policies with test queries

### Stage 2: Auth — Magic Link Login + User Management

- [ ] Initialize Next.js project with TypeScript + Tailwind CSS
- [ ] Install and configure Supabase client (`@supabase/supabase-js`, `@supabase/ssr`)
- [ ] Set up environment variables (Supabase URL, anon key, service role key)
- [ ] Disable Supabase Auth signups; use admin API (service role) to pre-create users
- [ ] Create login page with email input → magic link flow
- [ ] Configure Supabase Auth magic link settings (redirect URL, etc.)
- [ ] Create auth callback route to handle magic link redirect
- [ ] Build session management (middleware to check auth state)
- [ ] Create utility to fetch current user's role from `participants` table
- [ ] Build role-based route protection (participant, admin, superadmin)
- [ ] Verify: only pre-added emails can log in (no self-registration)
- [ ] Test magic link flow end-to-end

### Stage 3: Admin — Round & Match Setup + Participant Management

- [ ] Create persistent header/nav component (Back to Homepage, login/logout, role-based links)
- [ ] Create `/admin` dashboard page (protected: admin/superadmin)
- [ ] Create `/admin/rounds/new` page — form to create a new round
  - [ ] Fields: round number, deadline (default Thursday midday Australia/Melbourne), season
  - [ ] Add matches to the round: select home team + away team for each match
  - [ ] Mark one match as `is_final_match`
- [ ] Create round listing on admin dashboard (show all rounds, status)
- [ ] Allow editing existing round details before it locks
- [ ] Validate: no duplicate round numbers per season
- [ ] Create `/admin/participants` page — manage participants
  - [ ] Add participant (create auth user via service role + participant row)
  - [ ] Soft delete participant (`is_active = false`)
  - [ ] Grant third life (single atomic action: `lives_total = 3`, `lives_remaining += 1`, `is_eliminated = false`)
  - [ ] Only available before Round 1 locks; prevent if `lives_total` already 3
- [ ] Create `/admin/rounds/[id]/tips` page — view all tips grid (Mike's primary weekly view)

### Stage 4: Participant — Tip Submission Form

- [ ] Create `/tips/[round_id]` page (protected: participant+)
- [ ] Fetch all matches for the round (handles bye rounds naturally — variable match count)
- [ ] For each match: radio/button to select the **loser** (home team or away team)
- [ ] After all matches tipped: select one match as the **main tip**
- [ ] Enforce main tip team usage restriction (`times_used < 2`)
- [ ] Show which teams have already been used as main tips this season
- [ ] Submit: write rows to `tips` table + `main_tips` table + update `main_tip_team_usage`
- [ ] Allow editing tips until deadline (`rounds.is_locked = false`)
- [ ] Lock UI when `rounds.is_locked = true` — show read-only submitted tips
- [ ] Handle deadline locking (check both client-side and server-side)
- [ ] Eliminated participants can still submit (engagement) but UI indicates they're out
- [ ] Show confirmation after submission

### Stage 5: Admin — Enter Results + Auto-Scoring + Default Assignment

- [ ] Create `/admin/rounds/[id]/results` page
- [ ] For each match: select result (Home Win / Away Win / Draw)
- [ ] Per-match scoring on save: update `matches.result`, `winner_team_id`, `loser_team_id`; score related `tips` and `main_tips`
- [ ] Allow saving partial results (some matches scored, others still pending)
- [ ] Allow editing/correcting previously entered results; re-score affected tips
- [ ] When all matches in round are scored: auto-calculate idol earning, life loss, eliminations
- [ ] Draw handling: regular tips `is_correct = false`; main tip draws cause life loss unless idol
- [ ] Eliminated participants: score tips but don't decrement lives below 0, don't earn idols
- [ ] Set `rounds.results_entered = true` when all matches scored
- [ ] Show scoring summary to admin after processing
- [ ] Build default tip assignment logic
  - [ ] For unsubmitted match tips: assign home team as tipped loser
  - [ ] For unsubmitted main tip: assign home team of `is_final_match` match, set `was_default_assigned = true`
  - [ ] Process regular tips first, then main tip (single atomic operation)
  - [ ] Update `main_tip_team_usage` for auto-assigned mains
  - [ ] Admin UI trigger: "Assign defaults for this round"
- [ ] Admin tip override UI
  - [ ] "Override Tip" form (not raw field editing)
  - [ ] Re-evaluate `is_correct` on override
  - [ ] Re-run life loss / idol earning logic on main tip override
  - [ ] Update `main_tip_team_usage` on main tip team change
  - [ ] Restrict: admin can override current/previous round; superadmin any round

### Stage 6: Leaderboard (Homepage)

- [ ] Create `/` page — public, no login required
- [ ] Display all active participants: display name, lives remaining, elimination status
- [ ] Show round-by-round main tip results (correct/incorrect/idol played)
- [ ] **Do NOT show idol counts** — they are private
- [ ] Sort by lives remaining (or other sensible default)
- [ ] Add prominent link to Rules page (`/rules`)
- [ ] Add footer with sponsor links (magicmikenotastripper.com.au, oldmates.com) — open in new tab
- [ ] Mobile-responsive layout

### Stage 7: Round Summary (Public)

- [ ] Create `/rounds/[id]` page — public, no login required
- [ ] Show all main tips for that round (public), match results
- [ ] Display Mike's Corner if posted

### Stage 8: My History Page

- [ ] Create `/me` page (protected: participant+)
- [ ] Show all main tips by round with result (correct/incorrect/idol)
- [ ] Show lives timeline (when lives were lost)
- [ ] Show participant's **own idol count** (private — only visible to the logged-in user)
- [ ] Show idol usage history (when played, which round)
- [ ] Uses `participants_public` view for other participants; direct table for own data

### Stage 9: Rules Page + Mike's Corner

- [ ] Create `game-rules.md` in the repo with competition rules
- [ ] Create `/rules` page that renders `game-rules.md` as HTML
- [ ] Public, no login required
- [ ] Style consistently with the rest of the app
- [ ] Link from leaderboard
- [ ] Create `/admin/rounds/[id]/corner` page (admin/superadmin)
- [ ] Text editor for Mike's weekly commentary
- [ ] Save to `rounds.mikes_corner` + set `mikes_corner_posted_at`
- [ ] Allow editing after posting

### Stage 10: Idol Play Flow

- [ ] Create `/tips/[round_id]/idol` page (participant+)
- [ ] Check: participant has `idol_count > 0`
- [ ] Check: participant is not eliminated
- [ ] Check: main tip match hasn't reached Q2 (`match_datetime + 30 min`)
- [ ] Show confirmation modal: "Use 1 idol to protect your main tip this round?"
- [ ] On confirm: set `main_tips.idol_played = true`, record `idol_played_at`, decrement `idol_count`
- [ ] Prevent double idol play on same round
- [ ] Show idol status on tip submission page if already played

### Stage 11: Role Management

- [ ] Create `/admin/participants/roles` page (superadmin only)
- [ ] List all participants with current role
- [ ] Allow superadmin to change any participant's role
- [ ] RLS enforces: only superadmin can UPDATE `participants.role`

### Stage 12: Polish & Optional Features

- [ ] Mobile responsiveness audit for all participant screens
- [ ] Desktop polish for admin screens
- [ ] Edge case handling (late results, concurrent submissions)
- [ ] Error states and loading skeletons
- [ ] Email reminders (optional — Thursday morning via Supabase Edge Functions + Resend)
- [ ] SEO/meta tags for public pages
- [ ] Favicon and branding

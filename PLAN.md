# PLAN.md — AFL Survivor Pool Build Checklist

## Current Status

**Phase:** Pre-build (planning documents created)
**Last Updated:** 2026-03-10
**Next Step:** Stage 1 — Supabase Setup

---

## Known Issues / Decisions Pending

- [ ] Confirm Supabase project URL and anon/service keys
- [ ] Confirm domain registration (aflsurvivor.com) and Vercel project setup
- [ ] Decide on `game-rules.md` content (Stage 8 — need rules text from Mike or spec)
- [ ] Clarify idol Q2 deadline: use `match_datetime + 30 min` approximation or provide a separate field?
- [ ] Email reminder implementation details (Stage 14 — Resend vs Supabase Edge Functions vs skip)
- [ ] Confirm whether byes affect the tip submission form (does a bye round have fewer matches?)

---

## Build Stages

### Stage 1: Supabase Setup — Schema, RLS, Seed Data

- [ ] Initialize Supabase project config (or document connection setup)
- [ ] Create migration: `teams` table
- [ ] Create migration: `seasons` table
- [ ] Create migration: `participants` table with role enum (`participant`, `admin`, `superadmin`)
- [ ] Create migration: `rounds` table
- [ ] Create migration: `matches` table with result enum (`home_win`, `away_win`, `draw`, `pending`)
- [ ] Create migration: `tips` table with unique constraint (one tip per participant per match per round)
- [ ] Create migration: `main_tips` table with unique constraint (one main tip per participant per round)
- [ ] Create migration: `main_tip_team_usage` table
- [ ] Seed `teams` table with all 18 AFL teams (name, short_name, abbreviation)
- [ ] Write RLS policies for `tips` (own rows read/write for participant, all read for admin, full CRUD superadmin)
- [ ] Write RLS policies for `main_tips` (all read, own write for participant, full CRUD admin/superadmin)
- [ ] Write RLS policies for `matches` (read for participant, full CRUD admin/superadmin)
- [ ] Write RLS policies for `rounds` (read for participant, full CRUD admin/superadmin)
- [ ] Write RLS policies for `participants` (limited read for participant — no role column, full for admin/superadmin)
- [ ] Write RLS policy restricting `participants.role` updates to superadmin only
- [ ] Verify all policies with test queries

### Stage 2: Auth — Magic Link Login + User Management

- [ ] Initialize Next.js project with TypeScript
- [ ] Install and configure Supabase client (`@supabase/supabase-js`, `@supabase/ssr`)
- [ ] Set up environment variables (Supabase URL, anon key)
- [ ] Create login page with email input → magic link flow
- [ ] Configure Supabase Auth magic link settings (redirect URL, etc.)
- [ ] Create auth callback route to handle magic link redirect
- [ ] Build session management (middleware to check auth state)
- [ ] Create utility to fetch current user's role from `participants` table
- [ ] Build role-based route protection (participant, admin, superadmin)
- [ ] Verify: no self-registration — only pre-added emails can log in
- [ ] Test magic link flow end-to-end

### Stage 3: Admin — Round & Match Setup

- [ ] Create `/admin` dashboard page (protected: admin/superadmin)
- [ ] Create `/admin/rounds/new` page — form to create a new round
  - [ ] Fields: round number, deadline (default Thursday midday AEST), season
  - [ ] Add matches to the round: select home team + away team for each match
  - [ ] Mark one match as `is_final_match`
- [ ] Create round listing on admin dashboard (show all rounds, status)
- [ ] Allow editing existing round details before it locks
- [ ] Validate: no duplicate round numbers per season

### Stage 4: Participant — Tip Submission Form

- [ ] Create `/tips/[round_id]` page (protected: participant+)
- [ ] Fetch all matches for the round
- [ ] For each match: radio/button to select the **loser** (home team or away team)
- [ ] After all matches tipped: select one match as the **main tip**
- [ ] Enforce main tip team usage restriction (`times_used < 2`)
- [ ] Show which teams have already been used as main tips this season
- [ ] Submit: write rows to `tips` table + `main_tips` table + update `main_tip_team_usage`
- [ ] Allow editing tips until deadline (`rounds.is_locked = false`)
- [ ] Lock UI when `rounds.is_locked = true` — show read-only submitted tips
- [ ] Handle deadline locking (check both client-side and server-side)
- [ ] Show confirmation after submission

### Stage 5: Admin — Enter Results + Auto-Scoring

- [ ] Create `/admin/rounds/[id]/results` page
- [ ] For each match: select result (Home Win / Away Win / Draw)
- [ ] On submit: update `matches.result`, `matches.winner_team_id`, `matches.loser_team_id`
- [ ] Auto-score all `tips` for the round: set `is_correct` based on `tipped_loser_team_id` vs actual loser
- [ ] Auto-score all `main_tips` for the round: set `is_correct`
- [ ] Calculate **idol earning**: for each participant, if all tips correct → `idol_count += 1`
- [ ] Calculate **life loss**: for each participant, if main tip incorrect or draw (and no idol played) → `lives_remaining -= 1`
- [ ] Check eliminations: if `lives_remaining = 0` → `is_eliminated = true`
- [ ] Set `rounds.results_entered = true`
- [ ] Show scoring summary to admin after processing
- [ ] Handle draw results correctly (life loss unless idol)

### Stage 6: Leaderboard (Homepage)

- [ ] Create `/` page — public, no login required
- [ ] Display all participants: display name, lives remaining, elimination status
- [ ] Show round-by-round main tip results (correct/incorrect/idol played)
- [ ] **Do NOT show idol counts** — they are private
- [ ] Sort by lives remaining (or other sensible default)
- [ ] Add prominent link to Rules page (`/rules`)
- [ ] Add footer with sponsor links (magicmikenotastripper.com.au, oldmates.com) — open in new tab
- [ ] Mobile-responsive layout

### Stage 7: Global Navigation

- [ ] Create persistent header/nav component
- [ ] Include "Back to Homepage" link on every page
- [ ] Show login/logout state
- [ ] Show role-appropriate nav links (admin dashboard for admin/superadmin)
- [ ] Apply to all existing pages

### Stage 8: Rules Page

- [ ] Create `game-rules.md` in the repo with competition rules
- [ ] Create `/rules` page that renders `game-rules.md` as HTML
- [ ] Public, no login required
- [ ] Style consistently with the rest of the app
- [ ] Link from leaderboard

### Stage 9: My History Page

- [ ] Create `/me` page (protected: participant+)
- [ ] Show all main tips by round with result (correct/incorrect/idol)
- [ ] Show lives timeline (when lives were lost)
- [ ] Show participant's **own idol count** (private — only visible to the logged-in user)
- [ ] Show idol usage history (when played, which round)
- [ ] RLS ensures no cross-participant idol data leakage

### Stage 10: Mike's Corner

- [ ] Create `/admin/rounds/[id]/corner` page (admin/superadmin)
- [ ] Text editor for Mike's weekly commentary
- [ ] Save to `rounds.Mikes_corner` + set `Mikes_corner_posted_at`
- [ ] Display Mike's Corner on public round summary page (`/rounds/[id]`)
- [ ] Allow editing after posting

### Stage 11: Idol Play Flow

- [ ] Create `/tips/[round_id]/idol` page (participant+)
- [ ] Check: participant has `idol_count > 0`
- [ ] Check: main tip match hasn't reached Q2 (`match_datetime + 30 min`)
- [ ] Show confirmation modal: "Use 1 idol to protect your main tip this round?"
- [ ] On confirm: set `main_tips.idol_played = true`, record `idol_played_at`, decrement `idol_count`
- [ ] Prevent double idol play on same round
- [ ] Show idol status on tip submission page if already played

### Stage 12: Default Main Assignment

- [ ] Build auto-assignment logic (callable by admin or scheduled)
- [ ] For unsubmitted match tips: assign home team as tipped loser
- [ ] For unsubmitted main tip: assign home team of `is_final_match` match, set `was_default_assigned = true`
- [ ] Process regular tips first, then main tip (single atomic operation)
- [ ] Create admin UI trigger: "Assign defaults for this round"
- [ ] Optionally trigger automatically after deadline passes
- [ ] Update `main_tip_team_usage` for auto-assigned mains

### Stage 13: Role Management

- [ ] Create `/admin/participants/roles` page (superadmin only)
- [ ] List all participants with current role
- [ ] Allow superadmin to change any participant's role
- [ ] RLS enforces: only superadmin can UPDATE `participants.role`

### Stage 14: Polish & Optional Features

- [ ] Mobile responsiveness audit for all participant screens
- [ ] Desktop polish for admin screens
- [ ] Admin tip override UI
  - [ ] "Override Tip" form (not raw field editing)
  - [ ] Re-evaluate `is_correct` on override
  - [ ] Re-run life loss / idol earning logic on main tip override
  - [ ] Update `main_tip_team_usage` on main tip team change
  - [ ] Restrict: admin can override current/previous round; superadmin any round
- [ ] Third life grant UI
  - [ ] Single "Grant Third Life" button on manage participants page
  - [ ] Atomic update: `lives_total = 3`, `lives_remaining += 1`, `is_eliminated = false`
  - [ ] Only available before Round 1 locks
  - [ ] Prevent granting if `lives_total` already 3
- [ ] View all tips grid (`/admin/rounds/[id]/tips`)
- [ ] Edge case handling (draws, eliminated participants, late results)
- [ ] Email reminders (optional — Thursday morning via Supabase Edge Functions + Resend)
- [ ] Error states and loading skeletons
- [ ] SEO/meta tags for public pages
- [ ] Favicon and branding

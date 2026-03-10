# CLAUDE.md — Developer Reference for AFL Survivor Pool

> Persistent orientation file for Claude Code sessions. Read this first.

## Project Summary

A private web app for ~20 friends running an annual AFL tipping competition ("AFL Survivor Pool"). Participants tip the **loser** of each match weekly, nominate one as their **main tip**, and lose lives when their main tip is wrong. Last person standing wins.

Admin (Mike) enters results, posts commentary, and manages the competition. The app replaces his previous email + spreadsheet workflow.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | **Next.js** (React, SSR) |
| Hosting | **Vercel** (free tier) |
| Database + Auth | **Supabase** (Postgres, free tier) |
| Styling | **Tailwind CSS** |
| Auth method | **Supabase Magic Link** (email only, no passwords, no OAuth) |

## Project Conventions

- **No self-registration.** Superadmin adds participant emails; they log in via magic link.
- **Participant screens: mobile-first.** Admin screens: **desktop-first.**
- **Public pages require no login:** Leaderboard (`/`), Rules (`/rules`), Round Summary (`/rounds/[id]`).
- Every page must have a persistent **"Back to Homepage"** link in the header/nav.
- Domain: `aflsurvivor.com`
- Timezone for deadlines: **AEST** (Thursday midday).
- Footer on leaderboard includes sponsor links (magicmikenotastripper.com.au, oldmates.com) — open in new tab.
- Rules page renders `game-rules.md` from the repo.

## User Roles (enum on `participants.role`)

| Role | Access |
|------|--------|
| `participant` | Submit tips, view leaderboard, view own history + own idol count |
| `admin` | All above + enter results, post Mike's Corner, manage participants, create rounds, override tips (current/previous round only) |
| `superadmin` | All above + assign roles, override tips for any historical round, full CRUD everywhere |

Multiple users can hold any role. There is a **viewer** level (no login) for public pages.

## Database Schema Summary

### Core Tables

- **`teams`** — 18 AFL teams (static, seeded). Columns: `id`, `name`, `short_name`, `abbreviation`.
- **`seasons`** — Year, `is_active` (only one), `entry_cost`, `extra_life_cost`.
- **`participants`** — Linked to Supabase auth user. Key fields: `season_id`, `display_name`, `lives_total`, `lives_remaining`, `idol_count`, `is_eliminated`, `role`.
- **`rounds`** — `round_number` (1–24), `deadline`, `is_locked`, `results_entered`, `Mikes_corner`, `Mikes_corner_posted_at`.
- **`matches`** — Links to round + two teams. `result` enum: `home_win`/`away_win`/`draw`/`pending`. Has `is_final_match` flag (used for default main assignment).
- **`tips`** — One per participant per match per round. Stores `tipped_loser_team_id`. Private — not visible to other participants.
- **`main_tips`** — One per participant per round. Stores the publicly declared main tip. Includes `idol_played`, `idol_played_at`, `was_default_assigned`.
- **`main_tip_team_usage`** — Tracks per-participant, per-season usage of each team as a main tip. `times_used` max 2.

### Key Relationships

- `tips.match_id` → `matches.id`; `tips.participant_id` → `participants.id`
- `main_tips.tipped_loser_team_id` must match a tip already in the `tips` table for that round
- `main_tip_team_usage` enforces the 18-team/24-round constraint

## RLS (Row-Level Security) Approach

Policies check `participants.role` for the authenticated user on every protected query.

| Table | participant | admin | superadmin |
|-------|-------------|-------|------------|
| `tips` | Own rows (read + write before deadline) | All rows (read) | Full CRUD |
| `main_tips` | All rows (read), own rows (write before deadline) | All rows (read) | Full CRUD |
| `matches` | Read only | Full CRUD | Full CRUD |
| `rounds` | Read only | Full CRUD | Full CRUD |
| `participants` | Read (limited cols — **no role column**) | Read all, write limited | Full CRUD including role |

Role assignment (`UPDATE` on `participants.role`) restricted to `superadmin` only.

## Key Business Logic Rules

### Tip Defaults (Auto-Assignment at Deadline)

1. For every **unsubmitted match tip**: auto-assign **home team as the tipped loser**.
2. For **unsubmitted main tip**: auto-assign the home team of the `is_final_match = true` match; set `was_default_assigned = true`.
3. Regular tips are assigned first, then the main tip. Treat as a single atomic operation.
4. Can be triggered manually by admin or automatically after deadline.

### Life Loss

- Life lost when `main_tips.is_correct = false` **OR** result is a draw (and no idol played).
- Idol blocks life loss regardless of result.
- `lives_remaining` hits 0 → `is_eliminated = true`.

### Idol Earning (Private!)

- After results entered: if **ALL** `tips` for a participant in that round are correct → `idol_count += 1`.
- **Idol counts are private.** Participants see only their own. Not on leaderboard. Admins/superadmins can see all.

### Idol Playing

- `idol_played = true` on main tip **before Q2** of that match.
- Q2 approximation: `match_datetime + 30 minutes`.
- Decrements `idol_count` by 1.
- Makes main tip safe regardless of result.

### Third Life Buy-Back

- Participants start with **2 lives**. A third can be purchased (`seasons.extra_life_cost`).
- Payment handled offline; admin confirms and grants via UI.
- **Only before season starts** (before Round 1 is locked).
- Grant must be **atomic** — single action updates all three fields:
  - `lives_total` → 3
  - `lives_remaining` → current + 1
  - `is_eliminated` → false
- Cannot grant beyond `lives_total = 3`.

### Admin Tip Override

- Admin/superadmin can override any participant's tip (regular or main) for any round.
- Presented as an explicit "Override Tip" form — not raw field editing.
- On override: re-evaluate `is_correct`, re-run life loss / idol earning logic.
- Update `main_tip_team_usage` if main tip team changes (decrement old, increment new).
- **Superadmin only** can override tips more than one round in the past.

### Main Tip Team Restriction

- 18 teams across 24 rounds. Each team can be used as main tip at most **twice** per season.
- Enforce: `times_used < 2` only. (No requirement to use all 18 before doubling up.)

## Implementation Gotchas

1. **Tips are "loser" tips** — participants pick the team they think will **lose**, not win. Every label, form, and query must reflect this.
2. **Idol privacy is critical** — never leak idol counts to other participants. RLS + frontend must both enforce this.
3. **Deadline timezone** — all deadline logic must use AEST. Store as `timestamptz` in Postgres, handle conversion in app.
4. **`is_final_match`** — exactly one match per round should have this set to `true`; used for default main assignment.
5. **Draw handling** — draws cause life loss (same as incorrect main), unless idol played.
6. **Magic link auth** — no passwords, no OAuth. Supabase handles this natively.
7. **Atomic operations** — third life grant and default tip assignment must be transactional.
8. **Column naming** — spec uses `Mikes_corner` (capital M) on the rounds table.
9. **Sponsor links** in leaderboard footer: `magicmikenotastripper.com.au` and `oldmates.com` — must open in new tab.
10. **`participants.id`** links directly to Supabase auth user UUID — not a separate FK.

# AFL Tipping Competition — App Spec & Planning Document

## Overview
A private web app for ~20 friends running an annual AFL tipping competition called **AFL Survivor Pool**. Designed to reduce admin friction (primarily email volume for Mike) while keeping Mike central and involved. Participants need a dead-simple mobile-friendly experience.

**Suggested domain:** `aflsurvivor.com` (~$10–15 AUD/year). Short, memorable, keeps Mike front and centre.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js (React) | Best-in-class Vercel support, SSR for leaderboard pages |
| Hosting | Vercel | Free tier, familiar, ideal for Next.js |
| Database + Auth | Supabase | Familiar, Postgres, free tier handles this scale easily |
| Styling | Tailwind CSS | Fast, utility-first, mobile-friendly |

### Netlify vs Vercel
Stick with Vercel. Netlify has no meaningful advantage here — Vercel's native Next.js support, preview deployments, and free tier make it the right call for this stack.

### Cost Considerations
Both Supabase and Vercel free tiers are more than sufficient for ~20 users and a season of data. The only optional paid consideration worth noting:

- **Supabase Pro ($25/month) — NOT recommended.** Free tier handles this comfortably.
- **Custom domain (~$10–15 AUD/year) — Recommended.** `Mikestips.com.au` is short, personal, and easy for non-tech participants to remember and bookmark. Worth it. Register via Crazy Domains or Namecheap.

---

## User Roles

Roles are stored as an **enum** (`role` column on `participants` table) with three values. Multiple users can hold any role.

| Role | Who | Access |
|---|---|---|
| `participant` | ~20 friends | Submit tips, view leaderboard, view their own history |
| `admin` | Mike (+ anyone helping him) | Everything above + enter results, post Mike's Corner, manage participants, create rounds |
| `superadmin` | You (+ any backup) | Everything above + assign/change roles for any user, override and correct data, unlock rounds |
| **Viewer** (no login) | Anyone with the URL | Read-only leaderboard and round summaries |

**Key points:**
- There can be multiple admins — useful if Mike needs cover during the season
- Superadmin can promote/demote any user's role at any time
- Mike's day-to-day experience is identical to admin — superadmin is a back-door for you to fix things without disrupting his ownership of the comp
- Participants are added by superadmin upfront — there is **no self-registration**. You add each person's email, they just use magic link to log in.

---

## Database Schema

### `teams`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Richmond Tigers" |
| short_name | text | e.g. "Richmond" |
| abbreviation | text | e.g. "RIC" |

Seed with all 18 AFL teams at setup. Static table.

---

### `seasons`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| year | int | e.g. 2025 |
| is_active | boolean | Only one active season at a time |
| entry_cost | int | e.g. 250 |
| extra_life_cost | int | e.g. 150 |

---

### `participants`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, links to Supabase auth user |
| season_id | uuid | FK → seasons |
| display_name | text | Name shown on leaderboard |
| lives_total | int | 2 or 3 |
| lives_remaining | int | Decrements on wrong main tip |
| idol_count | int | Increments when full round tipped correctly |
| is_eliminated | boolean | True when lives_remaining = 0 |
| role | enum | `participant`, `admin`, `superadmin` — default `participant` |
| joined_at | timestamptz | |

---

### `rounds`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| season_id | uuid | FK → seasons |
| round_number | int | 1–24 |
| deadline | timestamptz | Thursday midday AEST |
| is_locked | boolean | True after deadline passes — no more tip submissions |
| results_entered | boolean | True once Mike has entered all match results |
| Mikes_corner | text | Mike's weekly commentary — nullable until posted |
| Mikes_corner_posted_at | timestamptz | |

---

### `matches`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| round_id | uuid | FK → rounds |
| home_team_id | uuid | FK → teams |
| away_team_id | uuid | FK → teams |
| match_datetime | timestamptz | Used for idol deadline (before Q2) |
| venue | text | Optional |
| result | enum | `home_win`, `away_win`, `draw`, `pending` |
| winner_team_id | uuid | FK → teams, null if draw or pending |
| loser_team_id | uuid | FK → teams, null if draw or pending |
| is_final_match | boolean | True = last match of round (used for default main assignment) |

---

### `tips`
Private tips submitted to Mike. Not visible to other participants.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| participant_id | uuid | FK → participants |
| round_id | uuid | FK → rounds |
| match_id | uuid | FK → matches |
| tipped_loser_team_id | uuid | FK → teams — the team they think will LOSE |
| is_correct | boolean | null until results entered, then true/false |
| submitted_at | timestamptz | |

Constraint: one tip per participant per match per round.

---

### `main_tips`
The publicly declared tip each week.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| participant_id | uuid | FK → participants |
| round_id | uuid | FK → rounds |
| match_id | uuid | FK → matches |
| tipped_loser_team_id | uuid | FK → teams — must match a tip already in `tips` table |
| is_correct | boolean | null until result known |
| idol_played | boolean | Default false |
| idol_played_at | timestamptz | Must be before Q2 of match |
| was_default_assigned | boolean | True if participant didn't tip and home team was assigned |
| submitted_at | timestamptz | |

Constraint: one main tip per participant per round.

---

### `main_tip_team_usage`
Tracks the 18-team / 24-round rule for main tips.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| participant_id | uuid | FK → participants |
| season_id | uuid | FK → seasons |
| team_id | uuid | FK → teams |
| times_used | int | Max 2 per season (for 6 teams), max 1 for rest |

---

## Business Logic (Key Rules to Encode)

### Tip Submission
- Tips locked at round deadline (Thursday midday AEST). Hard lock in DB via `rounds.is_locked`.
- Participants must tip one team (the loser) per match.
- Main tip must be one of the matches they've already tipped for that round.
- If a participant hasn't submitted tips for one or more matches by the deadline: auto-assign the **home team as the tipped loser** for every missing match. This applies to all unsubmitted regular tips, not just the main.
- If a participant hasn't submitted a main tip by the deadline: auto-assign the home team of the match where `is_final_match = true` as their main (set `was_default_assigned = true`).
- Both auto-assignments can be triggered manually by Mike or run automatically after the deadline passes. They should be treated as a single operation — assign all missing regular tips first, then assign the main if missing.

### Admin Tip Override
- Admins can correct or override any participant's tip (regular or main) for any round, including historical rounds.
- This is a deliberate, auditable action — not raw field editing. The admin UI must present it as an explicit "Override Tip" form.
- When a regular tip is overridden: update `tips.tipped_loser_team_id` and re-evaluate `tips.is_correct` against the known result if the round is already scored.
- When a main tip is overridden: update `main_tips.tipped_loser_team_id` and re-evaluate `main_tips.is_correct`, then re-run life loss / idol earning logic for that round for that participant.
- `main_tip_team_usage` must also be updated if the main tip team changes (decrement old team, increment new team).
- Override capability is available to `admin` and `superadmin` roles. Only `superadmin` can override tips for rounds more than one round in the past, to prevent casual mistakes by Mike.

### Main Tip Team Restriction
- Each of the 18 teams can only be used as a main **once**, except 6 teams can be used twice.
- Enforce via `main_tip_team_usage`: block submission if `times_used >= 2`, or if `times_used >= 1` and all 18 haven't been used once yet.
- **Important exception per rules:** You CAN double up on a team before using all 18 — the restriction is max 2 uses per team across the season, with the total cap being 24 (rounds). So enforce: times_used < 2 only.

### Life Loss
- Life is lost when: `main_tips.is_correct = false` OR result is a draw (and no idol was played).
- Idol blocks life loss regardless of result.
- When `participants.lives_remaining` hits 0: set `is_eliminated = true`.

### Idol Earning
- After Mike enters results for a round, check: if ALL `tips` for that participant in that round have `is_correct = true` → increment `idol_count` by 1.
- **Idol counts are private.** A participant can only see their own `idol_count`. Other participants cannot see each other's idol counts — not on the leaderboard, not anywhere. Admins and superadmins can see all idol counts.

### Idol Playing
- Participant can flag `idol_played = true` on their main tip before Q2 of that match.
- Check `idol_played_at` < `match Q2 start time` (can approximate as match_datetime + 30 minutes if Q2 time not available).
- Decrement `idol_count` by 1 when played.
- Idol makes that round's main safe regardless of result.

### Third Life / Buy-Back
- Participants start with 2 lives by default. A third life can be purchased (cost defined in `seasons.extra_life_cost`, e.g. $150).
- Payment is handled offline — Mike confirms receipt and then grants the third life via the admin UI.
- A third life can only be purchased **before the season starts**. Once Round 1 is locked, no new lives can be added.
- When an admin grants a third life to a participant, the following three fields must be updated **atomically** (as a single action, not separate edits):
  - `lives_total` → 3
  - `lives_remaining` → current lives + 1
  - `is_eliminated` → false (in case they had already hit 0 and been marked eliminated)
- The admin UI for this must be a single **"Grant Third Life"** action — not raw field editing — to prevent Mike accidentally updating only some of the fields and leaving the participant in an inconsistent state (e.g. lives > 0 but still showing as eliminated on the leaderboard).
- Once a third life has been granted, `lives_total = 3` is locked — it cannot be increased further.

---

## Pages & Screens

### Global Navigation
Every page across the entire site — public, participant, and admin — must include a **"Back to Homepage"** button or link that returns the user to `/`. This should be persistent and visible at all times, e.g. in a top navigation bar or header. No page should ever be a dead end.

### Public / No Login Required
| Page | Path | Description |
|---|---|---|
| Leaderboard (Homepage) | `/` | **This is the homepage.** Lives remaining, elimination status, round-by-round main tip results. Read-only. Anyone with the URL can view. Idol counts are **not shown** here — they are private. Includes a prominent link to the Rules page. Footer includes a "Special mention to our sponsors:" section with links to: [magicmikenotastripper.com.au](https://www.magicmikenotastripper.com.au/) and [oldmates.com](https://www.oldmates.com/). Links open in a new tab. |
| Rules | `/rules` | Renders the content of `game-rules.md` from the repo. Fully public, no login required. Linked from the leaderboard homepage. |
| Round Summary | `/rounds/[id]` | Main tips for that round (public), results, Mike's Corner |

### Participant (Login Required)
| Page | Path | Description |
|---|---|---|
| Submit Tips | `/tips/[round_id]` | Form to tip loser for every match + nominate main. Locked after deadline. |
| My History | `/me` | All my main tips by round, result, lives timeline, idol history. Participants can see their **own** idol count but not other participants'. |
| Play Idol | `/tips/[round_id]/idol` | Trigger idol play on current round main (time-gated) |

### Admin — Mike (Login Required, `admin` or `superadmin` role)
> **Design these screens desktop-first.** Mike works on a computer. Mobile is secondary for admin views.

| Page | Path | Description |
|---|---|---|
| Admin Dashboard | `/admin` | Round overview: who has/hasn't tipped, submission counts |
| View All Tips | `/admin/rounds/[id]/tips` | Full tip grid for the round — all participants, all matches |
| Enter Results | `/admin/rounds/[id]/results` | Enter winner/loser for each match, trigger scoring |
| Mike's Corner | `/admin/rounds/[id]/corner` | Text box to write and post weekly commentary |
| Manage Participants | `/admin/participants` | Add/remove participants, grant third life (see Business Logic), adjust lives (edge cases), manage idol counts |
| Round Setup | `/admin/rounds/new` | Create a new round, set matches and deadline |

### Superadmin Only (Login Required, `superadmin` role)

| Page | Path | Description |
|---|---|---|
| Role Management | `/admin/participants/roles` | Assign or change any participant's role (`participant`, `admin`, `superadmin`) |

---

## Key UI Flows

### Participant — Weekly Tip Submission
```
Login
  → Prompted if current round is open and not yet tipped
  → Tip submission form: list of all matches this round
      → For each match: select loser (Home Team | Away Team)
      → After all matches: select one as "Main Tip"
      → Confirm & Submit
  → Confirmation screen showing submitted tips + main
  → Can edit until deadline
```

### Participant — Playing an Idol
```
Login → My Round (current round)
  → If idol_count > 0 and main tip match hasn't started Q2:
      → "Play Idol" button visible
      → Confirm modal: "Use 1 idol to protect your main tip this round?"
      → Confirm → idol_played = true, idol_count - 1
```

### Mike — Entering Results
```
Admin login → Admin Dashboard
  → Select round → Enter Results
  → For each match: select outcome (Home Win / Away Win / Draw)
  → Submit → app auto-scores all tips and main tips
  → App calculates: idol earnings, life losses, eliminations
  → Mike reviews summary → Post Mike's Corner
```

---

## Notifications & Reminders (Optional, Low Priority)

These are nice-to-haves. All can be done cheaply or free:

- **Email reminders** (Thursday morning — "Tips close at midday!") via Supabase Edge Functions + Resend free tier (100 emails/day free). Recommended — saves Mike chasing people.
- **No push notifications needed** — not worth the complexity for this scale.

---

## Authentication

Use **Supabase Auth with Magic Link (email)**. No passwords ever created or remembered.

**How it works:**
- Superadmin adds each participant's email to the app upfront — no self-registration
- To log in: user goes to the site, enters their email, receives a one-tap magic link, clicks it, they're in
- Sessions persist so participants (especially Mike) won't need to re-login frequently if using the same device
- For Mike specifically: set up his browser with a bookmark to the admin dashboard and log him in the first time — most weeks he'll just open the bookmark and already be in

**Auth notes:**
- No OAuth/social login needed — keeps it simple and private
- Supabase RLS enforces data access based on the `role` column

---

## Supabase RLS Summary

| Table | participant | admin | superadmin |
|---|---|---|---|
| tips | Own rows only (read + write before deadline) | All rows (read) | Full CRUD |
| main_tips | All rows (read), own rows (write before deadline) | All rows (read) | Full CRUD |
| matches | Read only | Full CRUD | Full CRUD |
| rounds | Read only | Full CRUD | Full CRUD |
| participants | Read (limited cols — no role column) | Read all, write limited | Full CRUD including role assignment |

RLS policies should check `participants.role` for the authenticated user on every protected query. Role assignment (UPDATE on `participants.role`) is restricted to `superadmin` only.

---

## What Mike Does In The New World

Mike's role shifts from "email organiser + Excel tallier" to "app custodian + commentator":

1. **Thursday after midday** — Opens admin view, sees all tips in a grid (instead of 20 emails). Scans for anything interesting.
2. **After weekend games** — Enters match results (5–10 mins).
3. **App auto-tallies** everything — Mike reviews the summary.
4. **Posts Mike's Corner** — his weekly verdict, banter, shoutouts.
5. **Monitors edge cases** — idol plays, someone needing a life adjusted, etc.

He still has full control and visibility. He's just not copy-pasting emails into Excel anymore.

---

## Out of Scope (For Now)

- Automated AFL results ingestion (API). Could add later — the free squiggle.afl API exists — but Mike manually entering results keeps him involved and avoids API dependency.
- Mobile app (PWA via Next.js is sufficient and installable on home screen).
- Payment tracking (out of scope — handle offline).
- Historical seasons (build for current season first, schema supports it).

---

## Build Order Recommendation (for Claude Code)

1. **Supabase setup** — Schema, RLS policies, seed teams table
2. **Auth** — Magic link login, role enum (`participant` / `admin` / `superadmin`), superadmin adds users
3. **Admin: Round & Match setup** — Admin can create rounds and enter matches
4. **Participant: Tip submission form** — Core flow, deadline locking
5. **Admin: Enter results + auto-scoring** — Life loss, idol earning logic
6. **Leaderboard (homepage)** — Public-facing, lives, elimination status (no idol counts — those are private). Include link to Rules page.
7. **Global navigation** — "Back to Homepage" persistent header/nav on every page
8. **Rules page** — `/rules` renders `game-rules.md` from repo. Create `game-rules.md` at this step.
9. **My History page** — Participant self-view including their own idol count
10. **Mike's Corner** — Admin post, public display on round summary
11. **Idol play flow** — Time-gated, decrement logic
12. **Default main assignment** — Auto-assign if no tip submitted
13. **Role management** — Superadmin screen to assign/change roles
14. **Polish** — Mobile responsiveness for participant screens, desktop polish for admin screens, edge case handling, email reminders (optional)

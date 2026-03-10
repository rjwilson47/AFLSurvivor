# AFL Survivor Pool — Admin Guide

> Everything you need to run the competition week-to-week.
> This guide assumes you're logged in as **admin** or **superadmin**.

---

## Table of Contents

1. [First-Time Setup (Start of Season)](#1-first-time-setup-start-of-season)
2. [Adding Participants](#2-adding-participants)
3. [Weekly Workflow](#3-weekly-workflow)
4. [Entering Results & Scoring](#4-entering-results--scoring)
5. [Mike's Corner](#5-mikes-corner)
6. [Granting a Third Life](#6-granting-a-third-life)
7. [Overriding a Participant's Tip](#7-overriding-a-participants-tip)
8. [Removing or Deactivating Participants](#8-removing-or-deactivating-participants)
9. [Changing Roles](#9-changing-roles)
10. [Starting a New Season](#10-starting-a-new-season)
11. [When Do You Need SQL?](#11-when-do-you-need-sql)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. First-Time Setup (Start of Season)

Before the season begins, you need four things:

### A. Set Up the First Superadmin (SQL — once ever)

**This is a chicken-and-egg problem:** the app requires an admin to add participants, but there's no admin yet. You need to create the very first superadmin directly in the Supabase Dashboard.

**Step 1: Create the auth user**

Go to your Supabase Dashboard → **Authentication** (left sidebar) → **Users** tab → click **Add User** → **Create New User**.

- Enter your email address (e.g. mike@example.com)
- Tick **Auto Confirm User** (so you don't need to verify)
- Click **Create User**

Note the **User UID** shown in the users table — you'll need it in the next step. It looks like `a1b2c3d4-e5f6-...`.

**Step 2: Create the season and participant record**

Go to **SQL Editor** in the left sidebar, paste this, and click **Run**:

```sql
-- Create the first season
INSERT INTO seasons (year, is_active, entry_cost, extra_life_cost)
VALUES (2026, true, 50, 25);

-- Create the superadmin participant
-- Replace the user_id with YOUR User UID from Step 1
-- Replace the season_id by looking it up (or just use the subquery below)
INSERT INTO participants (user_id, season_id, display_name, role, lives_total, lives_remaining, idol_count, is_eliminated, is_active)
VALUES (
  'PASTE-YOUR-USER-UID-HERE',
  (SELECT id FROM seasons WHERE is_active = true),
  'Mike',
  'superadmin',
  2,
  2,
  0,
  false,
  true
);
```

Change `2026` to the current year, `'Mike'` to your display name, and paste your actual User UID from Step 1.

**Step 3: Log in**

Go to the app's login page, enter the same email address, and click to send a magic link. Check your email, click the link, and you're in as superadmin.

**You only need to do this once — ever.** From now on, you can add participants and assign roles from the app.

### B. Add Participants

Done entirely in the app — no SQL needed. See [Section 2](#2-adding-participants).

### C. Make Someone Else Admin (Optional)

If you want another person to be admin, first add them as a participant (Section 2), then change their role (Section 9). You can have multiple admins.

### D. Create Round 1

Done entirely in the app — no SQL needed. See [Section 3](#3-weekly-workflow).

---

## 2. Adding Participants

**Where:** Go to `/admin` → click **Manage Participants**

**Steps:**

1. Type the person's **email address** in the email field
2. Type their **display name** (what shows on the leaderboard, e.g. "Davo")
3. Click **Add Participant**

**What happens behind the scenes:**
- An account is created for them automatically
- A **magic link email** is sent to their address
- They click the link in the email → they're logged in (no password needed)
- They start with **2 lives** and **0 idols**

**Important:** Participants cannot sign up themselves. You must add every person here first. Only then can they log in.

**To add all ~20 participants:** Just repeat the steps above for each person. You can do them all in one sitting.

---

## 3. Weekly Workflow

This is what you do every round — typically once a week during the AFL season.

### Step 1: Create the Round

**Where:** `/admin` → click **New Round**

**Fill in:**
- **Round number** — 1, 2, 3, etc. (matches the AFL round)
- **Deadline** — When tips close. Usually Thursday midday Melbourne time. Pick the date and time using the date picker.
- **Matches** — Add each match for the round:
  - Select the **Home team** and **Away team** from the dropdowns
  - Optionally enter match date/time and venue
  - **Tick "Final match"** on exactly ONE match (this is used if someone forgets to submit — their default main tip is the home team of this match). Usually pick the last match of the round.
  - Click **Add Match** to add more rows

Click **Create Round** when done.

### Step 2: Wait for Deadline

Participants submit their tips via the app before the deadline. You can monitor progress on the admin dashboard — the **Tipped** column shows how many have submitted (e.g. "15/20").

### Step 3: Lock the Round & Assign Defaults

After the deadline passes:

1. Go to `/admin` → click **Edit** next to the round
2. Click **Lock Round** (yellow button) — this prevents any further tip changes
3. Click **Assign Defaults** (orange button) — this fills in tips for anyone who forgot:
   - Their regular tips default to the **home team as the loser** for each match
   - Their main tip defaults to the **home team of the final match**
   - A confirmation dialog will appear — click OK

### Step 4: Enter Results

As matches finish during the weekend, enter results. See [Section 4](#4-entering-results--scoring).

### Step 5: Post Commentary (Optional)

Write your weekly Mike's Corner. See [Section 5](#5-mikes-corner).

### Step 6: Repeat Next Week

That's it. **No SQL needed for any weekly tasks.**

---

## 4. Entering Results & Scoring

**Where:** `/admin` → click **Results** next to the round

You'll see every match listed with three buttons:
- **Home team name** — click if the home team won
- **Draw** — click if it was a draw
- **Away team name** — click if the away team won

**You can enter results one match at a time** — you don't have to wait until all matches are done. Each time you set a result:

- All tips for that match are immediately scored (correct/incorrect)
- A green "Scored" badge appears next to the match

**When ALL matches have results:**
- The app automatically calculates everything:
  - Who earned an idol (got every tip right)
  - Who loses a life (main tip was wrong and no idol played)
  - Who is eliminated (lives hit zero)
- A green banner confirms: "All matches scored!"
- The round appears on the public leaderboard

**Made a mistake?** Click the **Clear** button on any match to reset it to pending, then pick the correct result. Scoring recalculates automatically.

---

## 5. Mike's Corner

**Where:** `/admin` → click **Corner** next to the round

1. Write your weekly commentary in the text box
2. Click **Save & Post**
3. It's immediately visible on the round summary page that anyone can see

You can edit it anytime — just go back, change the text, and save again.

---

## 6. Granting a Third Life

Participants start with 2 lives. They can buy a third (payment handled offline — cash, transfer, etc.).

**Where:** `/admin` → **Manage Participants**

**Steps:**
1. Find the participant in the list
2. Click the purple **Grant 3rd Life** button next to their name

**Rules:**
- Can only be done **before Round 1 is locked**
- Each person can only have a maximum of 3 lives
- Once Round 1 is locked, this button disappears

---

## 7. Overriding a Participant's Tip

If someone asks you to change their tip (e.g. they made an error, or you need to fix something):

**Where:** `/admin` → click **Tips** next to the round

You'll see a grid of every participant's tips. Next to each participant's name is an **Override** link.

**Steps:**
1. Click **Override** next to the participant
2. A dialog pops up — choose:
   - **Override type:** Regular tip or Main tip
   - **Match:** Which match to change
   - **Tipped loser:** Which team they want as their loser pick
3. Click **Override**

**Rules:**
- Admins can only override tips for the **current or previous round**
- Superadmins can override any round
- For main tip overrides, the team must match one of the participant's regular tips for that match
- If the match already has a result, scoring recalculates immediately

---

## 8. Removing or Deactivating Participants

**There is no "delete" button** — and that's intentional. Deleting someone would destroy their tip history. Instead, you **deactivate** them.

**Where:** `/admin` → **Manage Participants**

**Steps:**
1. Find the participant
2. Click **Deactivate**

**What this does:**
- They disappear from the leaderboard and tip forms
- Their historical data is preserved
- They can no longer log in and submit tips

**To bring someone back:** Click **Reactivate** — they'll reappear everywhere.

---

## 9. Changing Roles

**Who can do this:** Superadmin only.

**Where:** `/admin` → **Manage Participants** → click **Manage Roles** (top of page)

**Steps:**
1. Find the participant
2. Use the dropdown to change their role:
   - **participant** — can submit tips and view the leaderboard
   - **admin** — all the above plus enter results, manage rounds, override tips
   - **superadmin** — all the above plus change roles and override historical tips

Changes take effect immediately.

---

## 10. Starting a New Season

At the start of a new AFL season (typically March):

### Step 1: Create the New Season (SQL)

Go to Supabase Dashboard → SQL Editor → run:

```sql
-- Deactivate last year's season
UPDATE seasons SET is_active = false WHERE is_active = true;

-- Create new season
INSERT INTO seasons (year, is_active, entry_cost, extra_life_cost)
VALUES (2027, true, 50, 25);
```

### Step 2: Re-add Yourself as Superadmin (SQL)

Because each season has its own participant records, you need to add yourself to the new season. Your auth user already exists from last year, so you just need a new participant row.

Go to Supabase Dashboard → SQL Editor → run:

```sql
INSERT INTO participants (user_id, season_id, display_name, role, lives_total, lives_remaining, idol_count, is_eliminated, is_active)
VALUES (
  'PASTE-YOUR-USER-UID-HERE',
  (SELECT id FROM seasons WHERE is_active = true),
  'Mike',
  'superadmin',
  2,
  2,
  0,
  false,
  true
);
```

To find your User UID: go to **Authentication** → **Users** in the Supabase Dashboard and copy it from the table.

### Step 3: Re-add Participants

Log into the app, go to `/admin` → **Manage Participants** and add everyone again. Each season has its own participant records, so returning players need to be re-added. They'll use the same email — they don't need a new account, just a new participant entry for the season.

### Step 4: Create Round 1

Same as the weekly workflow — go to `/admin` → **New Round**.

---

## 11. When Do You Need SQL?

Almost never. Here's the complete list:

| Task | SQL needed? |
|------|-------------|
| Set up first superadmin | **Yes** — once ever (see Section 1A) |
| Create a new season | **Yes** — once per year (see Section 10) |
| Re-add superadmin to new season | **Yes** — once per year (see Section 10) |
| Add participants | No — use the app |
| Create rounds | No — use the app |
| Add matches | No — use the app |
| Enter results | No — use the app |
| Lock rounds / assign defaults | No — use the app |
| Grant third life | No — use the app |
| Override tips | No — use the app |
| Write Mike's Corner | No — use the app |
| Deactivate a participant | No — use the app |
| Change roles | No — use the app |
| Run the database migrations | **Yes** — once when you first set up (or if the code is updated with new migrations) |

**You should never need to run SQL during the regular season.** The only exception would be if you need to fix corrupted data, which shouldn't happen in normal use.

### About Database Migrations

The files in `supabase/migrations/` define the database structure. You ran these once during setup:

- `00001_create_schema.sql` — tables and columns
- `00002_seed_teams.sql` — the 18 AFL teams
- `00003_rls_policies.sql` — security rules
- `00004_scoring_functions.sql` — scoring logic

**You only need to re-run these if the code is updated with changes to these files.** If that happens, you'll be told which file changed. For the scoring functions file (`00004`), you can safely re-run it anytime — it uses `CREATE OR REPLACE` so it just updates the functions without breaking anything.

**Never re-run `00001` or `00002`** on an existing database — they create tables and insert teams, which would fail if they already exist.

---

## 12. Troubleshooting

### "A participant says they can't log in"
- Check they're using the exact email you added them with
- They need to click the magic link in their email (check spam/junk)
- Links expire after a short time — they can request a new one on the login page
- Make sure they haven't been deactivated

### "Someone forgot to tip"
- If the round isn't locked yet: they can still submit via the app
- If the round is locked: use the **Override** feature (Section 7) to set their tips
- If defaults were already assigned: they'll have the home team as loser for each match. You can override individual tips if needed.

### "I entered the wrong result"
- Go to Results, click **Clear** on the match, then select the correct result
- All scoring recalculates automatically

### "The leaderboard isn't showing a round"
- The round only appears on the leaderboard after **all matches have results entered**
- Check the Results page — are there any matches still without a result?

### "A participant isn't showing on the leaderboard"
- They may have been deactivated — check Manage Participants
- They must be added to the **current season** — if a new season was created, they need to be re-added

### "I need to change someone's lives or idol count manually"
- This cannot be done from the app (by design — prevents accidental changes)
- If absolutely necessary, go to Supabase Dashboard → Table Editor → `participants` table → find the row → edit the value directly
- Only do this if something has gone wrong with scoring

---

## Quick Reference — Your Weekly Checklist

1. **Monday/Tuesday:** Create the new round with matches and deadline
2. **Before deadline:** Monitor tip submissions on the admin dashboard
3. **At deadline:** Lock the round, then assign defaults
4. **As matches finish:** Enter results one by one
5. **After all matches:** Verify the green "all scored" banner appears
6. **Anytime:** Write and post Mike's Corner

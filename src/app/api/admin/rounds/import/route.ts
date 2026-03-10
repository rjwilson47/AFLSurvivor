import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, hasRole } from '@/lib/auth'

// Team name mapping: fixture feed name (lowercase) → our DB short_name
// All keys are stored lowercase for case-insensitive matching
const TEAM_NAME_MAP: Record<string, string> = {
  'adelaide crows': 'Adelaide',
  'brisbane lions': 'Brisbane',
  'carlton blues': 'Carlton',
  'collingwood magpies': 'Collingwood',
  'essendon bombers': 'Essendon',
  'fremantle dockers': 'Fremantle',
  'geelong cats': 'Geelong',
  'gold coast suns': 'Gold Coast',
  'gws giants': 'GWS',
  'greater western sydney giants': 'GWS',
  'hawthorn hawks': 'Hawthorn',
  'melbourne demons': 'Melbourne',
  'north melbourne kangaroos': 'North Melbourne',
  'port adelaide power': 'Port Adelaide',
  'richmond tigers': 'Richmond',
  'st kilda saints': 'St Kilda',
  'sydney swans': 'Sydney',
  'west coast eagles': 'West Coast',
  'western bulldogs': 'Western Bulldogs',
  // Short names
  'adelaide': 'Adelaide',
  'brisbane': 'Brisbane',
  'carlton': 'Carlton',
  'collingwood': 'Collingwood',
  'essendon': 'Essendon',
  'fremantle': 'Fremantle',
  'geelong': 'Geelong',
  'gold coast': 'Gold Coast',
  'gws': 'GWS',
  'hawthorn': 'Hawthorn',
  'melbourne': 'Melbourne',
  'north melbourne': 'North Melbourne',
  'port adelaide': 'Port Adelaide',
  'richmond': 'Richmond',
  'st kilda': 'St Kilda',
  'sydney': 'Sydney',
  'west coast': 'West Coast',
}

function lookupTeamName(fixtureName: string): string | undefined {
  return TEAM_NAME_MAP[fixtureName.toLowerCase()]
}

interface FixtureMatch {
  MatchNumber: number
  RoundNumber: number
  DateUtc: string
  Location: string
  HomeTeam: string
  AwayTeam: string
}

// GET: Fetch and preview fixture data from external URL
export async function GET(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch fixture: ${res.status} ${res.statusText}` },
        { status: 400 }
      )
    }

    const fixtures: FixtureMatch[] = await res.json()

    // Group by round
    const roundMap = new Map<number, FixtureMatch[]>()
    for (const match of fixtures) {
      const round = match.RoundNumber
      if (!roundMap.has(round)) roundMap.set(round, [])
      roundMap.get(round)!.push(match)
    }

    // Build preview
    const rounds = Array.from(roundMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([roundNumber, matches]) => ({
        roundNumber,
        matchCount: matches.length,
        firstMatch: matches[0]?.DateUtc,
        matches: matches.map((m) => ({
          homeTeam: m.HomeTeam,
          awayTeam: m.AwayTeam,
          dateUtc: m.DateUtc,
          venue: m.Location,
        })),
      }))

    // Check for unmapped teams
    const allTeamNames = new Set<string>()
    for (const match of fixtures) {
      allTeamNames.add(match.HomeTeam)
      allTeamNames.add(match.AwayTeam)
    }
    const unmappedTeams = Array.from(allTeamNames).filter((t) => !lookupTeamName(t))

    return NextResponse.json({ rounds, unmappedTeams })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch fixture: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    )
  }
}

// POST: Import selected rounds from fixture data
export async function POST(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { url, selectedRounds, seasonId } = await request.json() as {
    url: string
    selectedRounds: number[]
    seasonId: string
  }

  if (!url || !selectedRounds?.length || !seasonId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch fixture data
  let fixtures: FixtureMatch[]
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch fixture data' }, { status: 400 })
    }
    fixtures = await res.json()
  } catch {
    return NextResponse.json({ error: 'Failed to fetch fixture data' }, { status: 400 })
  }

  const supabase = await createClient()

  // Load teams from DB to map names to IDs
  const { data: teams } = await supabase.from('teams').select('*')
  if (!teams) {
    return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 })
  }

  const teamByShortName = new Map(teams.map((t) => [t.short_name, t.id]))

  function resolveTeamId(fixtureName: string): string | null {
    const shortName = lookupTeamName(fixtureName)
    if (!shortName) return null
    return teamByShortName.get(shortName) ?? null
  }

  // Check existing rounds for this season
  const { data: existingRounds } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('season_id', seasonId)

  const existingRoundNumbers = new Set(existingRounds?.map((r) => r.round_number) ?? [])

  // Group fixture by round
  const roundMap = new Map<number, FixtureMatch[]>()
  for (const match of fixtures) {
    if (!selectedRounds.includes(match.RoundNumber)) continue
    if (!roundMap.has(match.RoundNumber)) roundMap.set(match.RoundNumber, [])
    roundMap.get(match.RoundNumber)!.push(match)
  }

  const results: { roundNumber: number; status: string }[] = []

  for (const [roundNumber, matches] of Array.from(roundMap.entries()).sort(([a], [b]) => a - b)) {
    if (existingRoundNumbers.has(roundNumber)) {
      results.push({ roundNumber, status: 'skipped (already exists)' })
      continue
    }

    // Resolve team IDs
    const resolvedMatches = []
    let hasUnmapped = false
    for (const m of matches) {
      const homeId = resolveTeamId(m.HomeTeam)
      const awayId = resolveTeamId(m.AwayTeam)
      if (!homeId || !awayId) {
        hasUnmapped = true
        break
      }
      resolvedMatches.push({
        home_team_id: homeId,
        away_team_id: awayId,
        match_datetime: m.DateUtc ? new Date(m.DateUtc).toISOString() : null,
        venue: m.Location || null,
      })
    }

    if (hasUnmapped) {
      results.push({ roundNumber, status: 'skipped (unmapped teams)' })
      continue
    }

    // Calculate deadline: Thursday before the earliest match at 5pm Melbourne time
    const matchDates = matches
      .map((m) => new Date(m.DateUtc))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    let deadlineIso: string
    if (matchDates.length > 0) {
      // Find the Thursday at or before the first match
      const firstMatch = matchDates[0]
      // Convert to Melbourne time to find the correct Thursday
      const melbFormatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      })
      const parts = melbFormatter.formatToParts(firstMatch)
      const year = parseInt(parts.find((p) => p.type === 'year')!.value)
      const month = parseInt(parts.find((p) => p.type === 'month')!.value) - 1
      const day = parseInt(parts.find((p) => p.type === 'day')!.value)

      // Create date in Melbourne timezone
      const melbDate = new Date(Date.UTC(year, month, day))
      const dayOfWeek = melbDate.getUTCDay() // 0=Sun, 4=Thu

      // Go back to the previous Thursday (or same day if it's Thursday)
      let daysBack = (dayOfWeek - 4 + 7) % 7
      if (daysBack === 0 && firstMatch.getUTCHours() < 7) {
        // If first match is Thursday early morning UTC (still Wednesday Melbourne),
        // go back a week
        daysBack = 7
      }
      const thursdayDate = new Date(melbDate.getTime() - daysBack * 86400000)

      // Thursday 5pm Melbourne = 5pm AEST (UTC+10) or 5pm AEDT (UTC+11)
      // Use a fixed approach: construct the datetime string and let Postgres handle TZ
      const thurYear = thursdayDate.getUTCFullYear()
      const thurMonth = String(thursdayDate.getUTCMonth() + 1).padStart(2, '0')
      const thurDay = String(thursdayDate.getUTCDate()).padStart(2, '0')
      // Store as Melbourne time with explicit timezone
      deadlineIso = `${thurYear}-${thurMonth}-${thurDay}T17:00:00+${isDST(thursdayDate) ? '11:00' : '10:00'}`
    } else {
      // Fallback: no valid dates, set a placeholder
      deadlineIso = new Date().toISOString()
    }

    // Mark the last match of the round as the final match
    const matchRows = resolvedMatches.map((m, i) => ({
      ...m,
      is_final_match: i === resolvedMatches.length - 1,
    }))

    // Create round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        round_number: roundNumber,
        deadline: deadlineIso,
        season_id: seasonId,
      })
      .select()
      .single()

    if (roundError) {
      results.push({ roundNumber, status: `error: ${roundError.message}` })
      continue
    }

    // Create matches
    const { error: matchError } = await supabase
      .from('matches')
      .insert(matchRows.map((m) => ({ ...m, round_id: round.id })))

    if (matchError) {
      await supabase.from('rounds').delete().eq('id', round.id)
      results.push({ roundNumber, status: `error: ${matchError.message}` })
      continue
    }

    results.push({ roundNumber, status: 'created' })
  }

  return NextResponse.json({ results })
}

// Helper: check if a date falls in AEDT (daylight saving time)
// AEDT: first Sunday of October to first Sunday of April
function isDST(date: Date): boolean {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() // 0-indexed

  // April to September: definitely AEST (no DST)
  if (month >= 3 && month <= 8) return false
  // November to February: definitely AEDT
  if (month >= 10 || month <= 1) return true

  // October: DST starts first Sunday
  if (month === 9) {
    const firstSunday = new Date(Date.UTC(year, 9, 1))
    while (firstSunday.getUTCDay() !== 0) {
      firstSunday.setUTCDate(firstSunday.getUTCDate() + 1)
    }
    return date >= firstSunday
  }

  // March: DST ends first Sunday
  if (month === 2) {
    const firstSunday = new Date(Date.UTC(year, 2, 1))
    while (firstSunday.getUTCDay() !== 0) {
      firstSunday.setUTCDate(firstSunday.getUTCDate() + 1)
    }
    return date < firstSunday
  }

  return false
}

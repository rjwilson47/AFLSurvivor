import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, hasRole } from '@/lib/auth'

export async function POST(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { round_number, deadline, season_id, has_main_tip, matches } = body as {
    round_number: number
    deadline: string
    season_id: string
    has_main_tip?: boolean
    matches: {
      home_team_id: string
      away_team_id: string
      match_datetime?: string
      venue?: string
      is_final_match: boolean
    }[]
  }

  if (!round_number || !deadline || !season_id || !matches?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const roundHasMainTip = has_main_tip !== false

  // Validate exactly one final match (only required when round has main tips)
  if (roundHasMainTip) {
    const finalCount = matches.filter((m) => m.is_final_match).length
    if (finalCount !== 1) {
      return NextResponse.json(
        { error: 'Exactly one match must be marked as the final match' },
        { status: 400 }
      )
    }
  }

  const supabase = await createClient()

  // Create the round
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({ round_number, deadline, season_id, has_main_tip: roundHasMainTip })
    .select()
    .single()

  if (roundError) {
    return NextResponse.json({ error: roundError.message }, { status: 400 })
  }

  // Create matches for the round
  const matchRows = matches.map((m) => ({
    round_id: round.id,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    match_datetime: m.match_datetime || null,
    venue: m.venue || null,
    is_final_match: m.is_final_match,
  }))

  const { error: matchError } = await supabase
    .from('matches')
    .insert(matchRows)

  if (matchError) {
    // Clean up the round if matches fail
    await supabase.from('rounds').delete().eq('id', round.id)
    return NextResponse.json({ error: matchError.message }, { status: 400 })
  }

  return NextResponse.json({ round })
}

export async function PUT(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { id, round_number, deadline, is_locked, has_main_tip, matches } = body as {
    id: string
    round_number?: number
    deadline?: string
    is_locked?: boolean
    has_main_tip?: boolean
    matches?: {
      id?: string
      home_team_id: string
      away_team_id: string
      match_datetime?: string
      venue?: string
      is_final_match: boolean
    }[]
  }

  const supabase = await createClient()

  // Update round fields
  const updates: Record<string, unknown> = {}
  if (round_number !== undefined) updates.round_number = round_number
  if (deadline !== undefined) updates.deadline = deadline
  if (is_locked !== undefined) updates.is_locked = is_locked
  if (has_main_tip !== undefined) updates.has_main_tip = has_main_tip

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('rounds')
      .update(updates)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  // If matches are provided, replace them
  if (matches) {
    // Final match validation only needed when round has main tips
    // Fetch current has_main_tip if not provided in this update
    const effectiveHasMainTip = has_main_tip ?? (await supabase
      .from('rounds')
      .select('has_main_tip')
      .eq('id', id)
      .single()
    ).data?.has_main_tip ?? true

    if (effectiveHasMainTip) {
      const finalCount = matches.filter((m) => m.is_final_match).length
      if (finalCount !== 1) {
        return NextResponse.json(
          { error: 'Exactly one match must be marked as the final match' },
          { status: 400 }
        )
      }
    }

    // Delete existing matches and re-insert
    await supabase.from('matches').delete().eq('round_id', id)

    const matchRows = matches.map((m) => ({
      round_id: id,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      match_datetime: m.match_datetime || null,
      venue: m.venue || null,
      is_final_match: m.is_final_match,
    }))

    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}

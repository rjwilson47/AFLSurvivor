import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, hasRole } from '@/lib/auth'

// Set or update a single match result, then trigger scoring
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: roundId } = await params
  const body = await request.json()
  const { match_id, result } = body as {
    match_id: string
    result: 'home_win' | 'away_win' | 'draw' | 'pending'
  }

  if (!match_id || !result) {
    return NextResponse.json({ error: 'Missing match_id or result' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Get match details to determine winner/loser
  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .eq('round_id', roundId)
    .single()

  if (!match) {
    return NextResponse.json({ error: 'Match not found in this round' }, { status: 404 })
  }

  // Determine winner/loser team IDs
  let winner_team_id: string | null = null
  let loser_team_id: string | null = null

  if (result === 'home_win') {
    winner_team_id = match.home_team_id
    loser_team_id = match.away_team_id
  } else if (result === 'away_win') {
    winner_team_id = match.away_team_id
    loser_team_id = match.home_team_id
  }
  // draw and pending: both null

  // Update match result (use admin client to bypass RLS for scoring)
  const { error: matchError } = await admin
    .from('matches')
    .update({ result, winner_team_id, loser_team_id })
    .eq('id', match_id)

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 400 })
  }

  // Trigger per-match scoring via database function
  const { error: scoreError } = await admin.rpc('score_match_tips', {
    p_match_id: match_id,
  })

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 400 })
  }

  // Check if all matches in round are now scored
  const { data: pendingMatches } = await admin
    .from('matches')
    .select('id')
    .eq('round_id', roundId)
    .eq('result', 'pending')

  const allScored = !pendingMatches || pendingMatches.length === 0

  return NextResponse.json({
    success: true,
    all_scored: allScored,
  })
}

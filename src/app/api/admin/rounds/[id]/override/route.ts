import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, hasRole, getParticipant } from '@/lib/auth'

// Override a participant's tip (regular or main)
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
  const {
    participant_id,
    type,
    match_id,
    tipped_loser_team_id,
  } = body as {
    participant_id: string
    type: 'tip' | 'main_tip'
    match_id: string
    tipped_loser_team_id: string
  }

  if (!participant_id || !type || !match_id || !tipped_loser_team_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Check round restriction: admin can only override current/previous round
  // Superadmin can override any round
  if (role === 'admin') {
    const currentParticipant = await getParticipant()
    if (!currentParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: round } = await supabase
      .from('rounds')
      .select('round_number, season_id')
      .eq('id', roundId)
      .single()

    if (round) {
      const { data: latestRound } = await supabase
        .from('rounds')
        .select('round_number')
        .eq('season_id', round.season_id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single()

      const latest = latestRound?.round_number ?? round.round_number
      if (round.round_number < latest - 1) {
        return NextResponse.json(
          { error: 'Admins can only override tips for the current or previous round. Contact superadmin for older rounds.' },
          { status: 403 }
        )
      }
    }
  }

  // Block main_tip override for rounds without main tips
  if (type === 'main_tip') {
    const { data: roundData } = await admin
      .from('rounds')
      .select('has_main_tip')
      .eq('id', roundId)
      .single()

    if (!roundData?.has_main_tip) {
      return NextResponse.json(
        { error: 'This round does not have a main tip' },
        { status: 400 }
      )
    }
  }

  // Validate match belongs to this round
  const { data: matchInRound } = await admin
    .from('matches')
    .select('id, result')
    .eq('id', match_id)
    .eq('round_id', roundId)
    .single()

  if (!matchInRound) {
    return NextResponse.json({ error: 'Match not found in this round' }, { status: 404 })
  }

  if (type === 'tip') {
    // Override regular tip
    const { error } = await admin
      .from('tips')
      .upsert(
        {
          participant_id,
          round_id: roundId,
          match_id,
          tipped_loser_team_id,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'participant_id,match_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Re-score if match has a result
    if (matchInRound.result !== 'pending') {
      await admin.rpc('score_match_tips', { p_match_id: match_id })
    }
  } else {
    // Override main tip
    // Validate that a matching regular tip exists for this participant/match/team
    const { data: regularTip } = await admin
      .from('tips')
      .select('id')
      .eq('participant_id', participant_id)
      .eq('match_id', match_id)
      .eq('tipped_loser_team_id', tipped_loser_team_id)
      .single()

    if (!regularTip) {
      return NextResponse.json(
        { error: 'Main tip must match one of the participant\'s regular tips for this match' },
        { status: 400 }
      )
    }

    // Get existing main tip to handle team usage update
    const { data: existingMain } = await admin
      .from('main_tips')
      .select('tipped_loser_team_id')
      .eq('participant_id', participant_id)
      .eq('round_id', roundId)
      .single()

    const { data: round } = await admin
      .from('rounds')
      .select('season_id')
      .eq('id', roundId)
      .single()

    // Upsert main tip
    const { error } = await admin
      .from('main_tips')
      .upsert(
        {
          participant_id,
          round_id: roundId,
          match_id,
          tipped_loser_team_id,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'participant_id,round_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update team usage by recounting from main_tips (simple and correct)
    const teamChanged = existingMain && existingMain.tipped_loser_team_id !== tipped_loser_team_id

    if (round && teamChanged) {
      // Recount old team usage
      const { count: oldCount } = await admin
        .from('main_tips')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', participant_id)
        .eq('tipped_loser_team_id', existingMain.tipped_loser_team_id)

      await admin
        .from('main_tip_team_usage')
        .upsert(
          {
            participant_id,
            season_id: round.season_id,
            team_id: existingMain.tipped_loser_team_id,
            times_used: oldCount ?? 0,
          },
          { onConflict: 'participant_id,season_id,team_id' }
        )
    }

    if (round && (teamChanged || !existingMain)) {
      // Recount new team usage
      const { count: newCount } = await admin
        .from('main_tips')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', participant_id)
        .eq('tipped_loser_team_id', tipped_loser_team_id)

      await admin
        .from('main_tip_team_usage')
        .upsert(
          {
            participant_id,
            season_id: round.season_id,
            team_id: tipped_loser_team_id,
            times_used: newCount ?? 1,
          },
          { onConflict: 'participant_id,season_id,team_id' }
        )
    }

    // Re-score if match has a result
    if (matchInRound.result !== 'pending') {
      await admin.rpc('score_match_tips', { p_match_id: match_id })
    }
  }

  return NextResponse.json({ success: true })
}

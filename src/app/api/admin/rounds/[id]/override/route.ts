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
      // Find the latest round number
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
    const { data: match } = await admin
      .from('matches')
      .select('result')
      .eq('id', match_id)
      .single()

    if (match && match.result !== 'pending') {
      await admin.rpc('score_match_tips', { p_match_id: match_id })
    }
  } else {
    // Override main tip
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

    // Update team usage if team changed
    if (
      round &&
      existingMain &&
      existingMain.tipped_loser_team_id !== tipped_loser_team_id
    ) {
      // Decrement old
      const { data: oldUsage } = await admin
        .from('main_tip_team_usage')
        .select('times_used')
        .eq('participant_id', participant_id)
        .eq('season_id', round.season_id)
        .eq('team_id', existingMain.tipped_loser_team_id)
        .single()

      if (oldUsage) {
        await admin
          .from('main_tip_team_usage')
          .update({ times_used: Math.max(oldUsage.times_used - 1, 0) })
          .eq('participant_id', participant_id)
          .eq('season_id', round.season_id)
          .eq('team_id', existingMain.tipped_loser_team_id)
      }

      // Increment new
      await admin
        .from('main_tip_team_usage')
        .upsert(
          {
            participant_id,
            season_id: round.season_id,
            team_id: tipped_loser_team_id,
            times_used: 1,
          },
          { onConflict: 'participant_id,season_id,team_id' }
        )
        .select()
      // If it already existed, we need to increment instead
      const { data: newUsage } = await admin
        .from('main_tip_team_usage')
        .select('times_used')
        .eq('participant_id', participant_id)
        .eq('season_id', round.season_id)
        .eq('team_id', tipped_loser_team_id)
        .single()

      if (newUsage && existingMain) {
        // The upsert may have set it to 1, but if it existed before we need to increment
        // Re-count from main_tips to be safe
        const { count } = await admin
          .from('main_tips')
          .select('*', { count: 'exact', head: true })
          .eq('participant_id', participant_id)
          .eq('tipped_loser_team_id', tipped_loser_team_id)

        await admin
          .from('main_tip_team_usage')
          .update({ times_used: count ?? 1 })
          .eq('participant_id', participant_id)
          .eq('season_id', round.season_id)
          .eq('team_id', tipped_loser_team_id)
      }
    }

    // Re-score if match has a result
    const { data: match } = await admin
      .from('matches')
      .select('result')
      .eq('id', match_id)
      .single()

    if (match && match.result !== 'pending') {
      await admin.rpc('score_match_tips', { p_match_id: match_id })
    }
  }

  return NextResponse.json({ success: true })
}

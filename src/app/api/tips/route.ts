import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getParticipant } from '@/lib/auth'

export async function POST(request: Request) {
  const participant = await getParticipant()
  if (!participant) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { round_id, tips, main_tip } = body as {
    round_id: string
    tips: { match_id: string; tipped_loser_team_id: string }[]
    main_tip: { match_id: string; tipped_loser_team_id: string }
  }

  if (!round_id || !tips?.length || !main_tip) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify round is not locked and deadline hasn't passed
  const { data: round } = await supabase
    .from('rounds')
    .select('is_locked, season_id, deadline')
    .eq('id', round_id)
    .single()

  if (!round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 })
  }

  if (round.is_locked) {
    return NextResponse.json({ error: 'Round is locked — tips cannot be changed' }, { status: 400 })
  }

  // Server-side deadline enforcement (backup even if round isn't locked yet)
  if (new Date() >= new Date(round.deadline)) {
    return NextResponse.json({ error: 'Deadline has passed — tips cannot be changed' }, { status: 400 })
  }

  // Validate main tip team matches one of the regular tips
  const mainTipInTips = tips.some(
    (t) =>
      t.match_id === main_tip.match_id &&
      t.tipped_loser_team_id === main_tip.tipped_loser_team_id
  )
  if (!mainTipInTips) {
    return NextResponse.json(
      { error: 'Main tip must match one of your regular tips' },
      { status: 400 }
    )
  }

  // Check main tip team usage (max 2 per season)
  const { data: usage } = await supabase
    .from('main_tip_team_usage')
    .select('times_used')
    .eq('participant_id', participant.id)
    .eq('season_id', round.season_id)
    .eq('team_id', main_tip.tipped_loser_team_id)
    .single()

  // Check if we're changing the main tip team (need to allow re-submitting same team)
  const { data: existingMainTip } = await supabase
    .from('main_tips')
    .select('tipped_loser_team_id')
    .eq('participant_id', participant.id)
    .eq('round_id', round_id)
    .single()

  const isChangingTeam =
    !existingMainTip ||
    existingMainTip.tipped_loser_team_id !== main_tip.tipped_loser_team_id

  if (isChangingTeam && usage && usage.times_used >= 2) {
    return NextResponse.json(
      { error: 'This team has already been used as main tip twice this season' },
      { status: 400 }
    )
  }

  // Upsert all regular tips
  for (const tip of tips) {
    const { error } = await supabase
      .from('tips')
      .upsert(
        {
          participant_id: participant.id,
          round_id,
          match_id: tip.match_id,
          tipped_loser_team_id: tip.tipped_loser_team_id,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'participant_id,match_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  // Upsert main tip
  const { error: mainError } = await supabase
    .from('main_tips')
    .upsert(
      {
        participant_id: participant.id,
        round_id,
        match_id: main_tip.match_id,
        tipped_loser_team_id: main_tip.tipped_loser_team_id,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id,round_id' }
    )

  if (mainError) {
    return NextResponse.json({ error: mainError.message }, { status: 400 })
  }

  // Update main tip team usage
  if (isChangingTeam) {
    // Decrement old team usage if there was an existing main tip
    if (existingMainTip) {
      await supabase
        .from('main_tip_team_usage')
        .update({ times_used: Math.max((usage?.times_used ?? 1) - 1, 0) })
        .eq('participant_id', participant.id)
        .eq('season_id', round.season_id)
        .eq('team_id', existingMainTip.tipped_loser_team_id)
    }

    // Increment new team usage
    await supabase
      .from('main_tip_team_usage')
      .upsert(
        {
          participant_id: participant.id,
          season_id: round.season_id,
          team_id: main_tip.tipped_loser_team_id,
          times_used: (usage?.times_used ?? 0) + 1,
        },
        { onConflict: 'participant_id,season_id,team_id' }
      )
  }

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getParticipant } from '@/lib/auth'

export async function POST(request: Request) {
  const participant = await getParticipant()
  if (!participant) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (participant.is_eliminated) {
    return NextResponse.json({ error: 'Eliminated participants cannot play idols' }, { status: 400 })
  }

  if (participant.idol_count <= 0) {
    return NextResponse.json({ error: 'No idols available' }, { status: 400 })
  }

  const { round_id } = (await request.json()) as { round_id: string }

  const supabase = await createClient()

  // Check if round has main tips
  const { data: round } = await supabase
    .from('rounds')
    .select('has_main_tip')
    .eq('id', round_id)
    .single()

  if (!round?.has_main_tip) {
    return NextResponse.json({ error: 'This round has no main tip' }, { status: 400 })
  }

  // Get the main tip for this round
  const { data: mainTip } = await supabase
    .from('main_tips')
    .select('*, matches!inner(match_datetime)')
    .eq('participant_id', participant.id)
    .eq('round_id', round_id)
    .single()

  if (!mainTip) {
    return NextResponse.json({ error: 'No main tip found for this round' }, { status: 400 })
  }

  if (mainTip.idol_played) {
    return NextResponse.json({ error: 'Idol already played for this round' }, { status: 400 })
  }

  // Check Q2 deadline (match_datetime + 30 minutes)
  const matchData = mainTip.matches as { match_datetime: string | null }
  if (matchData.match_datetime) {
    const q2Time = new Date(matchData.match_datetime)
    q2Time.setMinutes(q2Time.getMinutes() + 30)
    if (new Date() >= q2Time) {
      return NextResponse.json(
        { error: 'Cannot play idol — match has passed Q2' },
        { status: 400 }
      )
    }
  }

  // Play the idol
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('main_tips')
    .update({ idol_played: true, idol_played_at: now })
    .eq('id', mainTip.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  // Decrement idol count
  const { error: participantError } = await supabase
    .from('participants')
    .update({ idol_count: participant.idol_count - 1 })
    .eq('id', participant.id)

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

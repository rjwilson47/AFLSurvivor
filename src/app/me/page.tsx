import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import type { Team, Round, MainTip, Tip } from '@/lib/types'

export default async function MyHistoryPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Get participant for active season
  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!participant) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-zinc-500 dark:text-zinc-400">
          You are not registered for the current season.
        </p>
      </div>
    )
  }

  // Load data
  const [
    { data: rounds },
    { data: mainTips },
    { data: tips },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from('rounds')
      .select('*')
      .eq('season_id', participant.season_id)
      .order('round_number', { ascending: true }),
    supabase
      .from('main_tips')
      .select('*')
      .eq('participant_id', participant.id),
    supabase
      .from('tips')
      .select('*')
      .eq('participant_id', participant.id),
    supabase.from('teams').select('*'),
  ])

  const teamMap = new Map((teams as Team[])?.map((t) => [t.id, t]) ?? [])
  const roundList = (rounds as Round[]) ?? []
  const mainTipList = (mainTips as MainTip[]) ?? []
  const tipList = (tips as Tip[]) ?? []

  // Main tip by round
  const mainTipByRound = new Map<string, MainTip>()
  for (const mt of mainTipList) {
    mainTipByRound.set(mt.round_id, mt)
  }

  // Tips by round
  const tipsByRound = new Map<string, Tip[]>()
  for (const t of tipList) {
    if (!tipsByRound.has(t.round_id)) tipsByRound.set(t.round_id, [])
    tipsByRound.get(t.round_id)!.push(t)
  }

  // Calculate stats
  let livesLost = 0
  let idolsUsed = 0
  const lifeEvents: { round: number; team: string }[] = []

  for (const r of roundList) {
    const mt = mainTipByRound.get(r.id)
    if (!mt) continue
    if (mt.idol_played) idolsUsed++
    if (mt.is_correct === false && !mt.idol_played) {
      livesLost++
      const team = teamMap.get(mt.tipped_loser_team_id)
      lifeEvents.push({ round: r.round_number, team: team?.short_name ?? '?' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        My History
      </h1>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Lives</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {participant.lives_remaining}/{participant.lives_total}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Idols</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {participant.idol_count}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Idols Used</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {idolsUsed}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Status</p>
          <p
            className={`text-xl font-bold ${
              participant.is_eliminated
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {participant.is_eliminated ? 'OUT' : 'IN'}
          </p>
        </div>
      </div>

      {/* Life loss events */}
      {lifeEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Lives Lost
          </h2>
          <div className="space-y-1">
            {lifeEvents.map((e, i) => (
              <p key={i} className="text-sm text-zinc-600 dark:text-zinc-400">
                Round {e.round} — {e.team} to lose (wrong)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Round-by-round history */}
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Round History
      </h2>
      <div className="space-y-2">
        {roundList.map((r) => {
          const mt = mainTipByRound.get(r.id)
          const roundTips = tipsByRound.get(r.id) ?? []
          const team = mt ? teamMap.get(mt.tipped_loser_team_id) : null
          const allCorrect =
            roundTips.length > 0 &&
            roundTips.every((t) => t.is_correct === true)

          return (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            >
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  Round {r.round_number}
                </span>
                {mt && (
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                    Main: {team?.short_name ?? '?'} to lose
                    {mt.was_default_assigned && ' (default)'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {allCorrect && r.results_entered && (
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    +1 idol
                  </span>
                )}
                {mt?.idol_played ? (
                  <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                    ★ Idol
                  </span>
                ) : mt?.is_correct === true ? (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                    Safe
                  </span>
                ) : mt?.is_correct === false ? (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                    Life Lost
                  </span>
                ) : !mt ? (
                  <span className="text-xs text-zinc-400">No tip</span>
                ) : (
                  <span className="text-xs text-zinc-400">Pending</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

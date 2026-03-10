import { createClient } from '@/lib/supabase/server'
import type { Team, Participant, Tip, Round } from '@/lib/types'
import Link from 'next/link'

export default async function SeasonStatsPage() {
  const supabase = await createClient()

  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!season) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-red-600">No active season.</p>
      </div>
    )
  }

  const [{ data: participants }, { data: rounds }, { data: teams }] = await Promise.all([
    supabase
      .from('participants')
      .select('*')
      .eq('season_id', season.id)
      .eq('is_active', true)
      .order('display_name'),
    supabase
      .from('rounds')
      .select('*')
      .eq('season_id', season.id)
      .eq('results_entered', true)
      .order('round_number', { ascending: true }),
    supabase.from('teams').select('*'),
  ])

  const roundList = (rounds as Round[]) ?? []
  const participantList = (participants as Participant[]) ?? []

  // Load all tips for scored rounds
  const roundIds = roundList.map((r) => r.id)
  const { data: tips } = roundIds.length
    ? await supabase.from('tips').select('*').in('round_id', roundIds)
    : { data: [] }

  const tipList = (tips as Tip[]) ?? []

  // Build per-participant stats: overall + per-round
  type ParticipantStats = {
    participant: Participant
    totalCorrect: number
    totalScored: number
    roundStats: Map<string, { correct: number; total: number }>
  }

  const statsMap = new Map<string, ParticipantStats>()

  for (const p of participantList) {
    statsMap.set(p.id, {
      participant: p,
      totalCorrect: 0,
      totalScored: 0,
      roundStats: new Map(),
    })
  }

  for (const tip of tipList) {
    const stats = statsMap.get(tip.participant_id)
    if (!stats || tip.is_correct === null) continue

    stats.totalScored++
    if (tip.is_correct) stats.totalCorrect++

    const rs = stats.roundStats.get(tip.round_id) ?? { correct: 0, total: 0 }
    rs.total++
    if (tip.is_correct) rs.correct++
    stats.roundStats.set(tip.round_id, rs)
  }

  // Sort by accuracy descending, then by total correct
  const statsList = Array.from(statsMap.values()).sort((a, b) => {
    const aRate = a.totalScored > 0 ? a.totalCorrect / a.totalScored : 0
    const bRate = b.totalScored > 0 ? b.totalCorrect / b.totalScored : 0
    if (bRate !== aRate) return bRate - aRate
    return b.totalCorrect - a.totalCorrect
  })

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Season Tipping Accuracy
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Per-participant accuracy across {roundList.length} scored round{roundList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
        >
          Back to Admin
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="sticky left-0 bg-white px-3 py-2 font-medium text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                Participant
              </th>
              <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400">
                Season
              </th>
              <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400">
                %
              </th>
              {roundList.map((r) => (
                <th
                  key={r.id}
                  className="px-2 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400"
                >
                  R{r.round_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statsList.map((s) => {
              const pct =
                s.totalScored > 0
                  ? Math.round((s.totalCorrect / s.totalScored) * 100)
                  : 0

              return (
                <tr
                  key={s.participant.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/50"
                >
                  <td className="sticky left-0 bg-white px-3 py-2 font-medium text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
                    {s.participant.display_name}
                    {s.participant.is_eliminated && (
                      <span className="ml-1 text-[10px] text-red-500">OUT</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {s.totalCorrect}/{s.totalScored}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                        pct >= 70
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : pct >= 50
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}
                    >
                      {pct}%
                    </span>
                  </td>
                  {roundList.map((r) => {
                    const rs = s.roundStats.get(r.id)
                    if (!rs) {
                      return (
                        <td
                          key={r.id}
                          className="px-2 py-2 text-center text-zinc-300 dark:text-zinc-700"
                        >
                          —
                        </td>
                      )
                    }

                    return (
                      <td key={r.id} className="px-2 py-2 text-center">
                        <span
                          className={`text-[11px] font-medium ${
                            rs.correct === rs.total
                              ? 'text-green-600 dark:text-green-400'
                              : rs.correct >= rs.total * 0.5
                                ? 'text-zinc-700 dark:text-zinc-300'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {rs.correct}/{rs.total}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

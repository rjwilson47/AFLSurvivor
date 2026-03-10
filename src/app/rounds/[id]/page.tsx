import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Team, Match, MainTip, Round } from '@/lib/types'

export default async function RoundSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()

  if (!round) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-red-600">Round not found.</p>
      </div>
    )
  }

  const r = round as Round

  const [
    { data: matches },
    { data: teams },
    { data: participants },
    { data: mainTips },
  ] = await Promise.all([
    supabase
      .from('matches')
      .select('*')
      .eq('round_id', roundId)
      .order('match_datetime', { ascending: true, nullsFirst: false }),
    supabase.from('teams').select('*'),
    supabase
      .from('participants_public')
      .select('*')
      .eq('season_id', r.season_id)
      .eq('is_active', true)
      .order('display_name'),
    supabase.from('main_tips').select('*').eq('round_id', roundId),
  ])

  const teamMap = new Map((teams as Team[])?.map((t) => [t.id, t]) ?? [])
  const matchList = (matches as Match[]) ?? []
  const participantList = participants ?? []
  const mainTipList = (mainTips as MainTip[]) ?? []

  const mainTipsByParticipant = new Map<string, MainTip>()
  for (const mt of mainTipList) {
    mainTipsByParticipant.set(mt.participant_id, mt)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          &larr; Back to Leaderboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Round {r.round_number}
        </h1>
      </div>

      {/* Match results */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Results
        </h2>
        <div className="space-y-2">
          {matchList.map((m) => {
            const home = teamMap.get(m.home_team_id)
            const away = teamMap.get(m.away_team_id)
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
              >
                <span
                  className={`w-32 text-right font-medium ${
                    m.result === 'home_win'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {home?.short_name}
                </span>
                <span className="px-3 text-xs text-zinc-400">
                  {m.result === 'pending'
                    ? 'vs'
                    : m.result === 'draw'
                      ? 'DRAW'
                      : 'v'}
                </span>
                <span
                  className={`w-32 font-medium ${
                    m.result === 'away_win'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {away?.short_name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main tips (only for rounds with main tips) */}
      {r.is_locked && r.has_main_tip && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Main Tips
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                    Player
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                    Tipped Loser
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {participantList.map((p) => {
                  const mt = mainTipsByParticipant.get(p.id)
                  const team = mt
                    ? teamMap.get(mt.tipped_loser_team_id)
                    : null

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/50"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        {p.display_name}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {team?.short_name ?? '—'}
                        {mt?.was_default_assigned && (
                          <span className="ml-1 text-xs text-zinc-400">(default)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {mt?.idol_played ? (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            ★ Idol
                          </span>
                        ) : mt?.is_correct === true ? (
                          <span className="text-green-600 dark:text-green-400">
                            Correct
                          </span>
                        ) : mt?.is_correct === false ? (
                          <span className="text-red-600 dark:text-red-400">
                            Wrong
                          </span>
                        ) : (
                          <span className="text-zinc-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mike's Corner */}
      {r.mikes_corner && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Mike&apos;s Corner
          </h2>
          <div className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {r.mikes_corner}
          </div>
          {r.mikes_corner_posted_at && (
            <p className="mt-3 text-xs text-zinc-400">
              Posted{' '}
              {new Date(r.mikes_corner_posted_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Australia/Melbourne',
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

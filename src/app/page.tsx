import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import type { Team, MainTip, Round } from '@/lib/types'

export const revalidate = 60 // revalidate every 60 seconds

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // Get active season
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!season) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          AFL Survivor Pool
        </h1>
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">
          No active season. Check back soon!
        </p>
      </div>
    )
  }

  // Load participants (public view — no role/idol_count)
  const { data: participants } = await supabase
    .from('participants_public')
    .select('*')
    .eq('season_id', season.id)
    .eq('is_active', true)
    .eq('is_participating', true)
    .order('lives_remaining', { ascending: false })

  // Load rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('season_id', season.id)
    .order('round_number', { ascending: true })

  // Load all main tips for this season
  const roundIds = (rounds as Round[])?.map((r) => r.id) ?? []
  const { data: mainTips } = roundIds.length
    ? await supabase
        .from('main_tips')
        .select('*')
        .in('round_id', roundIds)
    : { data: [] }

  // Load teams
  const { data: teams } = await supabase.from('teams').select('*')

  // Count rebuys (participants who purchased a third life)
  const { count: rebuyCount } = await supabase
    .from('participants_public')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season.id)
    .eq('is_active', true)
    .eq('is_participating', true)
    .eq('lives_total', 3)

  const teamMap = new Map((teams as Team[])?.map((t) => [t.id, t]) ?? [])
  const roundList = (rounds as Round[]) ?? []
  const participantList = participants ?? []
  const mainTipList = (mainTips as MainTip[]) ?? []

  // Prize pool: $250 per participant + $150 per rebuy
  const prizePool = participantList.length * 250 + (rebuyCount ?? 0) * 150

  // Build lookup: participant_id -> round_id -> main_tip
  const mainTipLookup = new Map<string, Map<string, MainTip>>()
  for (const mt of mainTipList) {
    if (!mainTipLookup.has(mt.participant_id)) {
      mainTipLookup.set(mt.participant_id, new Map())
    }
    mainTipLookup.get(mt.participant_id)!.set(mt.round_id, mt)
  }

  // Only show rounds that have results and main tips (leaderboard shows main tip data)
  const scoredRounds = roundList.filter((r) => r.results_entered && r.has_main_tip)

  // Find latest round with Mike's Corner content
  const latestCornerRound = [...roundList]
    .filter((r) => r.results_entered && r.mikes_corner)
    .sort((a, b) => b.round_number - a.round_number)[0] ?? null

  // Check if logged-in user has untipped open rounds
  const user = await getUser()
  let openRoundToTip: Round | null = null

  if (user) {
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (participant) {
      const openRounds = roundList.filter((r) => !r.is_locked && new Date(r.deadline) > new Date())
      for (const r of openRounds) {
        const { data: existingMain } = await supabase
          .from('main_tips')
          .select('id')
          .eq('participant_id', participant.id)
          .eq('round_id', r.id)
          .single()

        if (!existingMain) {
          openRoundToTip = r
          break
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {openRoundToTip && (
        <Link
          href={`/tips/${openRoundToTip.id}`}
          className="mb-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
        >
          <span>
            Round {openRoundToTip.round_number} is open — submit your tips before the deadline!
          </span>
          <span className="font-medium">Tip now &rarr;</span>
        </Link>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            AFL Survivor Pool {season.year}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tip the loser. Last one standing wins.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-center dark:border-green-800 dark:bg-green-950">
            <p className="text-[10px] font-medium uppercase tracking-wide text-green-600 dark:text-green-400">
              Prize Pool
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              ${prizePool.toLocaleString()}
            </p>
          </div>
          <Link
            href="/rules"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Rules
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="sticky left-0 bg-white px-3 py-2 font-medium text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                Player
              </th>
              <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400">
                Lives
              </th>
              {scoredRounds.map((r) => (
                <th
                  key={r.id}
                  className="px-2 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400"
                >
                  <Link
                    href={`/rounds/${r.id}`}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    R{r.round_number}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participantList.map((p) => {
              const pMainTips = mainTipLookup.get(p.id)

              return (
                <tr
                  key={p.id}
                  className={`border-b border-zinc-100 dark:border-zinc-800/50 ${
                    p.is_eliminated ? 'opacity-50' : ''
                  }`}
                >
                  <td className="sticky left-0 bg-white px-3 py-2 font-medium text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
                    {p.display_name}
                    {p.is_eliminated && (
                      <span className="ml-1.5 text-xs text-red-500">OUT</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                        p.lives_remaining === 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : p.lives_remaining === 1
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}
                    >
                      {p.lives_remaining}/{p.lives_total}
                    </span>
                  </td>
                  {scoredRounds.map((r) => {
                    const mt = pMainTips?.get(r.id)
                    if (!mt) {
                      return (
                        <td
                          key={r.id}
                          className="px-2 py-2 text-center text-zinc-300 dark:text-zinc-700"
                        >
                          —
                        </td>
                      )
                    }

                    const team = teamMap.get(mt.tipped_loser_team_id)

                    let cellClass = ''
                    let icon = ''
                    if (mt.idol_played) {
                      cellClass = 'bg-yellow-50 dark:bg-yellow-900/20'
                      icon = ' ★'
                    } else if (mt.is_correct === true) {
                      cellClass = 'bg-green-50 dark:bg-green-900/20'
                    } else if (mt.is_correct === false) {
                      cellClass = 'bg-red-50 dark:bg-red-900/20'
                    }

                    return (
                      <td
                        key={r.id}
                        className={`px-2 py-2 text-center text-xs ${cellClass}`}
                        title={`${team?.short_name ?? '?'} to lose${mt.idol_played ? ' (idol played)' : ''}`}
                      >
                        <span
                          className={
                            mt.is_correct === true
                              ? 'text-green-700 dark:text-green-400'
                              : mt.is_correct === false && !mt.idol_played
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-zinc-700 dark:text-zinc-300'
                          }
                        >
                          {team?.abbreviation ?? '?'}
                          {icon}
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

      {participantList.length === 0 && (
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">
          No participants yet.
        </p>
      )}

      {/* Mike's Corner */}
      {latestCornerRound && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Mike&apos;s Corner — Round {latestCornerRound.round_number}
            </h2>
            <Link
              href={`/rounds/${latestCornerRound.id}`}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              View round &rarr;
            </Link>
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {latestCornerRound.mikes_corner}
          </div>
          {latestCornerRound.mikes_corner_posted_at && (
            <p className="mt-3 text-xs text-zinc-400">
              Posted{' '}
              {new Date(latestCornerRound.mikes_corner_posted_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Australia/Melbourne',
              })}
            </p>
          )}
        </div>
      )}

      {/* Sponsors footer */}
      <footer className="mt-12 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p className="mb-2">Special mention to our sponsors:</p>
        <div className="flex justify-center gap-4">
          <a
            href="https://www.magicmikenotastripper.com.au/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            magicmikenotastripper.com.au
          </a>
          <a
            href="https://www.oldmates.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            oldmates.com
          </a>
        </div>
      </footer>
    </div>
  )
}

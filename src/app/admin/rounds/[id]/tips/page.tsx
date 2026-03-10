import { createClient } from '@/lib/supabase/server'
import type { Team, Participant, Match, Tip, MainTip } from '@/lib/types'
import Link from 'next/link'
import { OverrideButton } from '@/components/override-button'

export default async function ViewTipsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roundId } = await params
  const supabase = await createClient()

  // Load round
  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()

  if (!round) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-red-600">Round not found.</p>
      </div>
    )
  }

  // Load all data in parallel
  const [
    { data: matches },
    { data: teams },
    { data: participants },
    { data: tips },
    { data: mainTips },
  ] = await Promise.all([
    supabase.from('matches').select('*').eq('round_id', roundId).order('created_at'),
    supabase.from('teams').select('*'),
    supabase
      .from('participants')
      .select('*')
      .eq('season_id', round.season_id)
      .eq('is_active', true)
      .order('display_name'),
    supabase.from('tips').select('*').eq('round_id', roundId),
    supabase.from('main_tips').select('*').eq('round_id', roundId),
  ])

  const teamMap = new Map((teams as Team[])?.map((t) => [t.id, t]) ?? [])
  const matchList = (matches as Match[]) ?? []
  const participantList = (participants as Participant[]) ?? []
  const tipList = (tips as Tip[]) ?? []
  const mainTipList = (mainTips as MainTip[]) ?? []

  // Build lookup: participant_id -> match_id -> tip
  const tipLookup = new Map<string, Map<string, Tip>>()
  for (const tip of tipList) {
    if (!tipLookup.has(tip.participant_id)) {
      tipLookup.set(tip.participant_id, new Map())
    }
    tipLookup.get(tip.participant_id)!.set(tip.match_id, tip)
  }

  // Build lookup: participant_id -> main_tip
  const mainTipLookup = new Map<string, MainTip>()
  for (const mt of mainTipList) {
    mainTipLookup.set(mt.participant_id, mt)
  }

  const tippedCount = participantList.filter((p) => tipLookup.has(p.id)).length

  // Serialize for client-side override component
  const matchesJson = JSON.stringify(matchList)
  const teamsJson = JSON.stringify(teams ?? [])

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Round {round.round_number} — All Tips
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {tippedCount} of {participantList.length} participants have tipped
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
              <th className="sticky left-0 bg-white px-2 py-2 font-medium text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                Participant
              </th>
              {matchList.map((m) => {
                const home = teamMap.get(m.home_team_id)
                const away = teamMap.get(m.away_team_id)
                return (
                  <th
                    key={m.id}
                    className="px-2 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    <div>{home?.abbreviation}</div>
                    <div className="text-zinc-400 dark:text-zinc-500">v</div>
                    <div>{away?.abbreviation}</div>
                    {m.is_final_match && (
                      <div className="mt-0.5 text-[10px] text-yellow-600 dark:text-yellow-400">
                        FINAL
                      </div>
                    )}
                  </th>
                )
              })}
              {round.has_main_tip && (
                <th className="px-2 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400">
                  Main Tip
                </th>
              )}
              <th className="px-2 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {participantList.map((p) => {
              const pTips = tipLookup.get(p.id)
              const mainTip = mainTipLookup.get(p.id)
              const mainTeam = mainTip
                ? teamMap.get(mainTip.tipped_loser_team_id)
                : null

              // Calculate score: correct tips / total scored tips
              const allTips = pTips ? Array.from(pTips.values()) : []
              const scoredTips = allTips.filter((t) => t.is_correct !== null)
              const correctTips = allTips.filter((t) => t.is_correct === true)
              const hasScores = scoredTips.length > 0

              return (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/50"
                >
                  <td className="sticky left-0 bg-white px-2 py-1.5 font-medium text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
                    <div className="flex items-center gap-1.5">
                      <span>
                        {p.display_name}
                        {p.is_eliminated && (
                          <span className="ml-1 text-[10px] text-red-500">OUT</span>
                        )}
                      </span>
                      <OverrideButton
                        roundId={roundId}
                        participantId={p.id}
                        participantName={p.display_name}
                        matchesJson={matchesJson}
                        teamsJson={teamsJson}
                      />
                    </div>
                  </td>
                  {matchList.map((m) => {
                    const tip = pTips?.get(m.id)
                    if (!tip) {
                      return (
                        <td
                          key={m.id}
                          className="px-2 py-1.5 text-center text-zinc-300 dark:text-zinc-700"
                        >
                          —
                        </td>
                      )
                    }

                    const tippedTeam = teamMap.get(tip.tipped_loser_team_id)
                    const isMain =
                      mainTip?.match_id === m.id &&
                      mainTip?.tipped_loser_team_id === tip.tipped_loser_team_id

                    let bgColor = ''
                    if (tip.is_correct === true) bgColor = 'bg-green-100 dark:bg-green-900/30'
                    else if (tip.is_correct === false)
                      bgColor = 'bg-red-100 dark:bg-red-900/30'

                    return (
                      <td
                        key={m.id}
                        className={`px-2 py-1.5 text-center ${bgColor}`}
                      >
                        <span
                          className={`${
                            isMain
                              ? 'font-bold text-blue-700 dark:text-blue-300'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {tippedTeam?.abbreviation ?? '?'}
                        </span>
                        {isMain && mainTip?.idol_played && (
                          <span className="ml-0.5 text-[10px] text-yellow-600">★</span>
                        )}
                      </td>
                    )
                  })}
                  {round.has_main_tip && (
                    <td className="px-2 py-1.5 text-center">
                      {mainTeam ? (
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {mainTeam.abbreviation}
                          {mainTip?.was_default_assigned && (
                            <span className="ml-0.5 text-[10px] text-zinc-400">(D)</span>
                          )}
                          {mainTip?.idol_played && (
                            <span className="ml-0.5 text-yellow-600">★</span>
                          )}
                          {mainTip?.is_correct === true && (
                            <span className="ml-0.5 text-green-600">✓</span>
                          )}
                          {mainTip?.is_correct === false && (
                            <span className="ml-0.5 text-red-600">✗</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center">
                    {hasScores ? (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                          correctTips.length === scoredTips.length
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : correctTips.length >= scoredTips.length * 0.5
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}
                      >
                        {correctTips.length}/{scoredTips.length}
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {participantList.length === 0 && (
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">
          No participants found for this season.
        </p>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Team, Match, Round, Tip, MainTip } from '@/lib/types'

interface TeamUsage {
  team_id: string
  times_used: number
}

export default function TipSubmissionPage({
  params,
}: {
  params: Promise<{ round_id: string }>
}) {
  const { round_id } = use(params)
  const [round, setRound] = useState<Round | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [isEliminated, setIsEliminated] = useState(false)

  // Tip state: match_id -> tipped_loser_team_id
  const [tipSelections, setTipSelections] = useState<Record<string, string>>({})
  // Main tip: match_id
  const [mainMatchId, setMainMatchId] = useState<string | null>(null)
  const [teamUsage, setTeamUsage] = useState<TeamUsage[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      // Get current user's participant record
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: participant } = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!participant) return
      setParticipantId(participant.id)
      setIsEliminated(participant.is_eliminated)

      // Load round, matches, teams, existing tips in parallel
      const [roundRes, matchesRes, teamsRes, tipsRes, mainTipRes, usageRes] =
        await Promise.all([
          supabase.from('rounds').select('*').eq('id', round_id).single(),
          supabase
            .from('matches')
            .select('*')
            .eq('round_id', round_id)
            .order('match_datetime', { ascending: true, nullsFirst: false }),
          supabase.from('teams').select('*'),
          supabase
            .from('tips')
            .select('*')
            .eq('participant_id', participant.id)
            .eq('round_id', round_id),
          supabase
            .from('main_tips')
            .select('*')
            .eq('participant_id', participant.id)
            .eq('round_id', round_id)
            .single(),
          supabase
            .from('main_tip_team_usage')
            .select('team_id, times_used')
            .eq('participant_id', participant.id)
            .eq('season_id', participant.season_id),
        ])

      if (roundRes.data) setRound(roundRes.data as Round)
      if (matchesRes.data) setMatches(matchesRes.data as Match[])
      if (teamsRes.data) setTeams(teamsRes.data as Team[])
      if (usageRes.data) setTeamUsage(usageRes.data as TeamUsage[])

      // Load existing selections
      if (tipsRes.data) {
        const selections: Record<string, string> = {}
        for (const tip of tipsRes.data as Tip[]) {
          selections[tip.match_id] = tip.tipped_loser_team_id
        }
        setTipSelections(selections)
      }

      if (mainTipRes.data) {
        setMainMatchId((mainTipRes.data as MainTip).match_id)
      }

      setLoading(false)
    }

    load()
  }, [round_id])

  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const usageMap = new Map(teamUsage.map((u) => [u.team_id, u.times_used]))

  const allMatchesTipped = matches.every((m) => tipSelections[m.id])

  function getTeamUsageCount(teamId: string): number {
    return usageMap.get(teamId) ?? 0
  }

  function isTeamAtLimit(teamId: string): boolean {
    // Already at 2 uses — can't use again
    // But if this team is already the selected main for this round, allow it
    if (mainMatchId && tipSelections[mainMatchId] === teamId) return false
    return getTeamUsageCount(teamId) >= 2
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!participantId) return
    if (round?.has_main_tip && !mainMatchId) return
    setError('')
    setSaving(true)
    setSaved(false)

    const tips = Object.entries(tipSelections).map(
      ([match_id, tipped_loser_team_id]) => ({
        match_id,
        tipped_loser_team_id,
      })
    )

    let mainTipPayload: { match_id: string; tipped_loser_team_id: string } | null = null
    if (round?.has_main_tip && mainMatchId) {
      const mainTipTeamId = tipSelections[mainMatchId]
      if (!mainTipTeamId) {
        setError('Please select a tip for your main match first')
        setSaving(false)
        return
      }
      mainTipPayload = {
        match_id: mainMatchId,
        tipped_loser_team_id: mainTipTeamId,
      }
    }

    const res = await fetch('/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round_id,
        tips,
        main_tip: mainTipPayload,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to submit tips')
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-red-600">Round not found.</p>
      </div>
    )
  }

  const isLocked = round.is_locked
  const deadlineStr = new Date(round.deadline).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Melbourne',
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Round {round.round_number} Tips
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Deadline: {deadlineStr}
      </p>

      {isEliminated && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          You have been eliminated, but you can still submit tips for fun.
        </div>
      )}

      {isLocked ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          This round is locked. Tips can no longer be changed.
        </div>
      ) : null}

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Tips submitted successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Tip each match */}
        <div className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Pick the loser of each match
          </h2>
          {matches.map((match) => {
            const home = teamMap.get(match.home_team_id)
            const away = teamMap.get(match.away_team_id)
            const selected = tipSelections[match.id]

            return (
              <div
                key={match.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs text-zinc-400 dark:text-zinc-500">
                    {match.match_datetime
                      ? new Date(match.match_datetime).toLocaleDateString(
                          'en-AU',
                          {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Australia/Melbourne',
                          }
                        )
                      : ''}
                    {match.venue ? ` — ${match.venue}` : ''}
                  </div>
                  {match.is_final_match && (
                    <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                      FINAL MATCH
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      setTipSelections({
                        ...tipSelections,
                        [match.id]: match.home_team_id,
                      })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selected === match.home_team_id
                        ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                        : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    } disabled:opacity-50`}
                  >
                    {home?.short_name ?? 'Home'}
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      setTipSelections({
                        ...tipSelections,
                        [match.id]: match.away_team_id,
                      })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selected === match.away_team_id
                        ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                        : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    } disabled:opacity-50`}
                  >
                    {away?.short_name ?? 'Away'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step 2: Select main tip (only for rounds with main tips) */}
        {round?.has_main_tip && allMatchesTipped && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Select your main tip
            </h2>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Choose one of your tipped losers as your main tip for this round.
              If your main tip is wrong, you lose a life.
            </p>
            <div className="space-y-2">
              {matches.map((match) => {
                const tippedLoserId = tipSelections[match.id]
                if (!tippedLoserId) return null
                const tippedLoser = teamMap.get(tippedLoserId)
                const otherTeamId =
                  tippedLoserId === match.home_team_id
                    ? match.away_team_id
                    : match.home_team_id
                const otherTeam = teamMap.get(otherTeamId)
                const usageCount = getTeamUsageCount(tippedLoserId)
                const atLimit = isTeamAtLimit(tippedLoserId)

                return (
                  <button
                    key={match.id}
                    type="button"
                    disabled={isLocked || atLimit}
                    onClick={() => setMainMatchId(match.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      mainMatchId === match.id
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950'
                        : atLimit
                          ? 'border-zinc-200 opacity-50 dark:border-zinc-800'
                          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          mainMatchId === match.id
                            ? 'font-bold text-blue-700 dark:text-blue-300'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }
                      >
                        {tippedLoser?.short_name} to lose
                        <span className="ml-1 text-xs text-zinc-400">
                          (vs {otherTeam?.short_name})
                        </span>
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {usageCount > 0
                          ? `Used ${usageCount}/2`
                          : ''}
                        {atLimit && ' (limit reached)'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {!isLocked && (
          <button
            type="submit"
            disabled={saving || !allMatchesTipped || (round?.has_main_tip && !mainMatchId)}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Submitting...' : saved ? 'Update Tips' : 'Submit Tips'}
          </button>
        )}
      </form>

      {/* Idol play link — show when round is locked and has main tip */}
      {isLocked && round?.has_main_tip && (
        <div className="mt-6">
          <Link
            href={`/tips/${round_id}/idol`}
            className="inline-flex items-center rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 dark:hover:bg-yellow-900"
          >
            ★ Play Idol
          </Link>
        </div>
      )}
    </div>
  )
}

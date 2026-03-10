'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Team, Match, Round } from '@/lib/types'

export default function EnterResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: roundId } = use(params)
  const router = useRouter()
  const [round, setRound] = useState<Round | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [allScored, setAllScored] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [roundRes, matchesRes, teamsRes] = await Promise.all([
        supabase.from('rounds').select('*').eq('id', roundId).single(),
        supabase
          .from('matches')
          .select('*')
          .eq('round_id', roundId)
          .order('match_datetime', { ascending: true, nullsFirst: false }),
        supabase.from('teams').select('*'),
      ])

      if (roundRes.data) setRound(roundRes.data as Round)
      if (matchesRes.data) {
        const m = matchesRes.data as Match[]
        setMatches(m)
        setAllScored(m.every((match) => match.result !== 'pending'))
      }
      if (teamsRes.data) setTeams(teamsRes.data as Team[])
      setLoading(false)
    }
    load()
  }, [roundId])

  const teamMap = new Map(teams.map((t) => [t.id, t]))

  async function setResult(
    matchId: string,
    result: 'home_win' | 'away_win' | 'draw' | 'pending'
  ) {
    setSaving(matchId)
    setMessage('')

    const res = await fetch(`/api/admin/rounds/${roundId}/results`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, result }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(`Error: ${data.error}`)
    } else {
      // Update local state
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id !== matchId) return m
          const home = m.home_team_id
          const away = m.away_team_id
          return {
            ...m,
            result,
            winner_team_id:
              result === 'home_win' ? home : result === 'away_win' ? away : null,
            loser_team_id:
              result === 'home_win' ? away : result === 'away_win' ? home : null,
          }
        })
      )

      if (data.all_scored) {
        setAllScored(true)
        setMessage('All matches scored! Round outcomes calculated.')
      }
    }

    setSaving(null)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-red-600">Round not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Round {round.round_number} — Enter Results
        </h1>
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          Back to Admin
        </button>
      </div>

      {allScored && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          All matches scored. Idol earning, life loss, and eliminations have been calculated.
        </div>
      )}

      {message && !allScored && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          {message}
        </div>
      )}

      <div className="space-y-3">
        {matches.map((match) => {
          const home = teamMap.get(match.home_team_id)
          const away = teamMap.get(match.away_team_id)
          const isSaving = saving === match.id

          return (
            <div
              key={match.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
                </span>
                {match.result !== 'pending' && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Scored
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="w-32 text-right text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {home?.short_name}
                </span>

                <div className="flex gap-1">
                  <button
                    onClick={() => setResult(match.id, 'home_win')}
                    disabled={isSaving}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      match.result === 'home_win'
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Win
                  </button>
                  <button
                    onClick={() => setResult(match.id, 'draw')}
                    disabled={isSaving}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      match.result === 'draw'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Draw
                  </button>
                  <button
                    onClick={() => setResult(match.id, 'away_win')}
                    disabled={isSaving}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      match.result === 'away_win'
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Win
                  </button>
                </div>

                <span className="w-32 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {away?.short_name}
                </span>

                {match.result !== 'pending' && (
                  <button
                    onClick={() => setResult(match.id, 'pending')}
                    disabled={isSaving}
                    className="ml-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

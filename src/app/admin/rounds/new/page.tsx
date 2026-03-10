'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Team, Season } from '@/lib/types'

interface MatchForm {
  home_team_id: string
  away_team_id: string
  match_datetime: string
  venue: string
  is_final_match: boolean
}

const emptyMatch = (): MatchForm => ({
  home_team_id: '',
  away_team_id: '',
  match_datetime: '',
  venue: '',
  is_final_match: false,
})

export default function NewRoundPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [deadline, setDeadline] = useState('')
  const [hasMainTip, setHasMainTip] = useState(true)
  const [matches, setMatches] = useState<MatchForm[]>([emptyMatch()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [teamsRes, seasonRes] = await Promise.all([
        supabase.from('teams').select('*').order('short_name'),
        supabase.from('seasons').select('*').eq('is_active', true).single(),
      ])
      if (teamsRes.data) setTeams(teamsRes.data)
      if (seasonRes.data) setSeason(seasonRes.data)
    }
    load()
  }, [])

  function addMatch() {
    setMatches([...matches, emptyMatch()])
  }

  function removeMatch(index: number) {
    if (matches.length <= 1) return
    setMatches(matches.filter((_, i) => i !== index))
  }

  function updateMatch(index: number, field: keyof MatchForm, value: string | boolean) {
    const updated = [...matches]
    if (field === 'is_final_match') {
      // Only one final match allowed — unset others
      updated.forEach((m, i) => {
        m.is_final_match = i === index ? (value as boolean) : false
      })
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(updated[index] as any)[field] = value
    }
    setMatches(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!season) return
    setError('')
    setSaving(true)

    // Validate
    for (const m of matches) {
      if (!m.home_team_id || !m.away_team_id) {
        setError('All matches must have home and away teams selected')
        setSaving(false)
        return
      }
      if (m.home_team_id === m.away_team_id) {
        setError('Home and away teams cannot be the same')
        setSaving(false)
        return
      }
    }

    if (hasMainTip && !matches.some((m) => m.is_final_match)) {
      setError('One match must be marked as the final match of the round')
      setSaving(false)
      return
    }

    const res = await fetch('/api/admin/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round_number: roundNumber,
        deadline,
        season_id: season.id,
        has_main_tip: hasMainTip,
        matches,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to create round')
      setSaving(false)
      return
    }

    router.push('/admin')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Create New Round
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Round Number
            </label>
            <input
              type="number"
              min={0}
              max={27}
              value={roundNumber}
              onChange={(e) => setRoundNumber(Number(e.target.value))}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Enter in your local time — stored as Australia/Melbourne timezone
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasMainTip}
            onChange={(e) => setHasMainTip(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Require main tip for this round
          </span>
          {!hasMainTip && (
            <span className="text-xs text-zinc-400">(no life risk, tips only)</span>
          )}
        </label>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Matches
            </h2>
            <button
              type="button"
              onClick={addMatch}
              className="rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + Add Match
            </button>
          </div>

          <div className="space-y-3">
            {matches.map((match, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Match {i + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={match.is_final_match}
                        onChange={(e) => updateMatch(i, 'is_final_match', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-zinc-600 dark:text-zinc-400">Final match</span>
                    </label>
                    {matches.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMatch(i)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400">Home Team</label>
                    <select
                      value={match.home_team_id}
                      onChange={(e) => updateMatch(i, 'home_team_id', e.target.value)}
                      required
                      className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">Select team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.short_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400">Away Team</label>
                    <select
                      value={match.away_team_id}
                      onChange={(e) => updateMatch(i, 'away_team_id', e.target.value)}
                      required
                      className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">Select team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.short_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400">Date/Time</label>
                    <input
                      type="datetime-local"
                      value={match.match_datetime}
                      onChange={(e) => updateMatch(i, 'match_datetime', e.target.value)}
                      className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400">Venue</label>
                    <input
                      type="text"
                      value={match.venue}
                      onChange={(e) => updateMatch(i, 'venue', e.target.value)}
                      placeholder="Optional"
                      className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Round'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

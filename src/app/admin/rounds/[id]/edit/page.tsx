'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Team, Round, Match } from '@/lib/types'

interface MatchForm {
  id?: string
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

export default function EditRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [round, setRound] = useState<Round | null>(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [deadline, setDeadline] = useState('')
  const [matches, setMatches] = useState<MatchForm[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [teamsRes, roundRes, matchesRes] = await Promise.all([
        supabase.from('teams').select('*').order('short_name'),
        supabase.from('rounds').select('*').eq('id', id).single(),
        supabase.from('matches').select('*').eq('round_id', id).order('created_at'),
      ])

      if (teamsRes.data) setTeams(teamsRes.data)
      if (roundRes.data) {
        const r = roundRes.data as Round
        setRound(r)
        setRoundNumber(r.round_number)
        // Convert deadline to local datetime-local format
        const d = new Date(r.deadline)
        setDeadline(d.toISOString().slice(0, 16))
      }
      if (matchesRes.data) {
        setMatches(
          (matchesRes.data as Match[]).map((m) => ({
            id: m.id,
            home_team_id: m.home_team_id,
            away_team_id: m.away_team_id,
            match_datetime: m.match_datetime
              ? new Date(m.match_datetime).toISOString().slice(0, 16)
              : '',
            venue: m.venue || '',
            is_final_match: m.is_final_match,
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [id])

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
    setError('')
    setSaving(true)

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

    if (!matches.some((m) => m.is_final_match)) {
      setError('One match must be marked as the final match of the round')
      setSaving(false)
      return
    }

    const res = await fetch('/api/admin/rounds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        round_number: roundNumber,
        deadline,
        matches,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to update round')
      setSaving(false)
      return
    }

    router.push('/admin')
  }

  async function handleLock() {
    const res = await fetch('/api/admin/rounds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_locked: !round?.is_locked }),
    })
    if (res.ok) {
      setRound(round ? { ...round, is_locked: !round.is_locked } : null)
    }
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
          Edit Round {round.round_number}
        </h1>
        <button
          onClick={handleLock}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            round.is_locked
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-yellow-600 text-white hover:bg-yellow-700'
          }`}
        >
          {round.is_locked ? 'Unlock Round' : 'Lock Round'}
        </button>
      </div>

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
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Matches</h2>
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
              <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
                      <button type="button" onClick={() => removeMatch(i)} className="text-red-500 hover:text-red-700 text-sm">
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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
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

'use client'

import { useState } from 'react'
import type { Team, Match } from '@/lib/types'

interface OverrideDialogProps {
  roundId: string
  participantId: string
  participantName: string
  matches: Match[]
  teams: Map<string, Team>
  onClose: () => void
}

export function OverrideDialog({
  roundId,
  participantId,
  participantName,
  matches,
  teams,
  onClose,
}: OverrideDialogProps) {
  const [type, setType] = useState<'tip' | 'main_tip'>('tip')
  const [matchId, setMatchId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedMatch = matches.find((m) => m.id === matchId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!matchId || !teamId) return
    setSaving(true)
    setError('')
    setSuccess('')

    const res = await fetch(`/api/admin/rounds/${roundId}/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        type,
        match_id: matchId,
        tipped_loser_team_id: teamId,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to override')
    } else {
      setSuccess(`${type === 'tip' ? 'Tip' : 'Main tip'} overridden successfully`)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Override Tip — {participantName}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Override type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'tip' | 'main_tip')}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="tip">Regular tip</option>
              <option value="main_tip">Main tip</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Match
            </label>
            <select
              value={matchId}
              onChange={(e) => {
                setMatchId(e.target.value)
                setTeamId('')
              }}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Select match...</option>
              {matches.map((m) => {
                const home = teams.get(m.home_team_id)
                const away = teams.get(m.away_team_id)
                return (
                  <option key={m.id} value={m.id}>
                    {home?.short_name} vs {away?.short_name}
                  </option>
                )
              })}
            </select>
          </div>

          {selectedMatch && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tipped loser
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTeamId(selectedMatch.home_team_id)}
                  className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
                    teamId === selectedMatch.home_team_id
                      ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                      : 'border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {teams.get(selectedMatch.home_team_id)?.short_name}
                </button>
                <button
                  type="button"
                  onClick={() => setTeamId(selectedMatch.away_team_id)}
                  className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
                    teamId === selectedMatch.away_team_id
                      ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                      : 'border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {teams.get(selectedMatch.away_team_id)?.short_name}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !matchId || !teamId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Override'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

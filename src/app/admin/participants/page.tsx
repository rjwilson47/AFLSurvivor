'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Participant, Season } from '@/lib/types'

export default function ManageParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [adding, setAdding] = useState(false)
  const [round1Locked, setRound1Locked] = useState(false)

  async function loadData() {
    const supabase = createClient()

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single()

    if (seasonData) {
      setSeason(seasonData)

      const { data: participantData } = await supabase
        .from('participants')
        .select('*')
        .eq('season_id', seasonData.id)
        .order('display_name')

      if (participantData) setParticipants(participantData)

      // Check if Round 1 is locked (for third life eligibility)
      const { data: round1 } = await supabase
        .from('rounds')
        .select('is_locked')
        .eq('season_id', seasonData.id)
        .eq('round_number', 1)
        .single()

      setRound1Locked(round1?.is_locked ?? false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAddParticipant(e: React.FormEvent) {
    e.preventDefault()
    if (!season) return
    setError('')
    setSuccess('')
    setAdding(true)

    const res = await fetch('/api/admin/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        display_name: displayName,
        season_id: season.id,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(`Added ${displayName}`)
      setEmail('')
      setDisplayName('')
      loadData()
    }
    setAdding(false)
  }

  async function handleAction(participantId: string, action: string) {
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/participants', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: participantId, action }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess('Updated successfully')
      loadData()
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Manage Participants
      </h1>

      {/* Add Participant Form */}
      <div className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add Participant
        </h2>
        <form onSubmit={handleAddParticipant} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="participant@email.com"
              className="mt-1 block w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Name on leaderboard"
              className="mt-1 block w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {success}
        </div>
      )}

      {/* Participants Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Role</th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Lives</th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Idols</th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-zinc-100 dark:border-zinc-800/50 ${
                  !p.is_active ? 'opacity-50' : ''
                }`}
              >
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                  {p.display_name}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{p.role}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {p.lives_remaining}/{p.lives_total}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{p.idol_count}</td>
                <td className="px-3 py-2">
                  {!p.is_active ? (
                    <span className="text-zinc-400">Inactive</span>
                  ) : p.is_eliminated ? (
                    <span className="text-red-600 dark:text-red-400">Eliminated</span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400">Active</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {p.is_active && p.lives_total < 3 && !round1Locked && (
                      <button
                        onClick={() => handleAction(p.id, 'grant_third_life')}
                        className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800"
                      >
                        Grant 3rd Life
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(p.id, 'toggle_active')}
                      className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      {p.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {participants.length === 0 && (
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">
          No participants yet. Add some above.
        </p>
      )}
    </div>
  )
}

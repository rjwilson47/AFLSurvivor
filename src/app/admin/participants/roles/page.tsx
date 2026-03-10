'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Participant, ParticipantRole } from '@/lib/types'

export default function RoleManagementPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSuperadmin, setIsSuperadmin] = useState(false)

  async function loadData() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // Check if current user is superadmin
    const { data: currentParticipant } = await supabase
      .from('participants')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (currentParticipant?.role !== 'superadmin') {
      setIsSuperadmin(false)
      setLoading(false)
      return
    }
    setIsSuperadmin(true)

    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single()

    if (season) {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('season_id', season.id)
        .eq('is_active', true)
        .order('display_name')

      if (data) setParticipants(data as Participant[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleRoleChange(participantId: string, newRole: ParticipantRole) {
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/participants', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: participantId, role: newRole }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to update role')
    } else {
      setSuccess('Role updated')
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!isSuperadmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">Superadmin access required.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Role Management
      </h1>

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

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </th>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Current Role
            </th>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Change To
            </th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr
              key={p.id}
              className="border-b border-zinc-100 dark:border-zinc-800/50"
            >
              <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                {p.display_name}
              </td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                {p.role}
              </td>
              <td className="px-3 py-2">
                <select
                  value={p.role}
                  onChange={(e) =>
                    handleRoleChange(p.id, e.target.value as ParticipantRole)
                  }
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="participant">participant</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

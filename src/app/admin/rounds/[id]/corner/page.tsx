'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MikesCornerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: roundId } = use(params)
  const router = useRouter()
  const [content, setContent] = useState('')
  const [roundNumber, setRoundNumber] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('rounds')
        .select('round_number, mikes_corner')
        .eq('id', roundId)
        .single()
      if (data) {
        setRoundNumber(data.round_number)
        setContent(data.mikes_corner || '')
      }
      setLoading(false)
    }
    load()
  }, [roundId])

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    const res = await fetch(`/api/admin/rounds/${roundId}/corner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (res.ok) {
      setSaved(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Mike&apos;s Corner — Round {roundNumber}
        </h1>
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          Back to Admin
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        placeholder="Write your weekly commentary here..."
        className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Post'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Saved! Visible on the round summary page.
          </span>
        )}
      </div>
    </div>
  )
}

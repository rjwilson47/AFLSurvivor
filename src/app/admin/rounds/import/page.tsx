'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Season } from '@/lib/types'

interface PreviewMatch {
  homeTeam: string
  awayTeam: string
  dateUtc: string
  venue: string
}

interface PreviewRound {
  roundNumber: number
  matchCount: number
  firstMatch: string
  matches: PreviewMatch[]
}

interface ImportResult {
  roundNumber: number
  status: string
}

const DEFAULT_URL = 'https://fixturedownload.com/feed/json/afl-2026'

export default function ImportFixturePage() {
  const router = useRouter()
  const [season, setSeason] = useState<Season | null>(null)
  const [url, setUrl] = useState(DEFAULT_URL)
  const [rounds, setRounds] = useState<PreviewRound[]>([])
  const [unmappedTeams, setUnmappedTeams] = useState<string[]>([])
  const [selectedRounds, setSelectedRounds] = useState<Set<number>>(new Set())
  const [expandedRound, setExpandedRound] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data) setSeason(data)
      })
  }, [])

  async function handlePreview() {
    setError('')
    setResults(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/rounds/import?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setLoading(false)
        return
      }

      setRounds(data.rounds)
      setUnmappedTeams(data.unmappedTeams)
      // Select all rounds by default
      setSelectedRounds(new Set(data.rounds.map((r: PreviewRound) => r.roundNumber)))
    } catch {
      setError('Failed to fetch fixture data')
    }

    setLoading(false)
  }

  async function handleImport() {
    if (!season || selectedRounds.size === 0) return
    setError('')
    setImporting(true)

    try {
      const res = await fetch('/api/admin/rounds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          selectedRounds: Array.from(selectedRounds),
          seasonId: season.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
      } else {
        setResults(data.results)
      }
    } catch {
      setError('Import failed')
    }

    setImporting(false)
  }

  function toggleRound(roundNumber: number) {
    const next = new Set(selectedRounds)
    if (next.has(roundNumber)) {
      next.delete(roundNumber)
    } else {
      next.add(roundNumber)
    }
    setSelectedRounds(next)
  }

  function toggleAll() {
    if (selectedRounds.size === rounds.length) {
      setSelectedRounds(new Set())
    } else {
      setSelectedRounds(new Set(rounds.map((r) => r.roundNumber)))
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Melbourne',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Import AFL Fixture
      </h1>

      <div className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Fixture JSON URL
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="https://fixturedownload.com/feed/json/afl-2026"
          />
          <button
            onClick={handlePreview}
            disabled={loading || !url}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          First listed team = home team. Deadline auto-set to Thursday 5pm Melbourne time before each round.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {unmappedTeams.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
          <strong>Unmapped teams:</strong> {unmappedTeams.join(', ')}
          <br />
          These teams won&apos;t be imported. The team name mapping may need updating.
        </div>
      )}

      {results && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <h3 className="mb-2 font-semibold text-green-800 dark:text-green-200">Import Results</h3>
          <div className="space-y-1 text-sm">
            {results.map((r) => (
              <div
                key={r.roundNumber}
                className={`${
                  r.status === 'created'
                    ? 'text-green-700 dark:text-green-300'
                    : r.status.startsWith('error')
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Round {r.roundNumber}: {r.status}
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Admin
          </button>
        </div>
      )}

      {rounds.length > 0 && !results && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {rounds.length} Rounds Found
              </h2>
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {selectedRounds.size === rounds.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || selectedRounds.size === 0}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {importing
                ? 'Importing...'
                : `Import ${selectedRounds.size} Round${selectedRounds.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="space-y-2">
            {rounds.map((r) => (
              <div
                key={r.roundNumber}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRounds.has(r.roundNumber)}
                    onChange={() => toggleRound(r.roundNumber)}
                    className="rounded"
                  />
                  <button
                    onClick={() =>
                      setExpandedRound(expandedRound === r.roundNumber ? null : r.roundNumber)
                    }
                    className="flex flex-1 items-center justify-between text-left"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      Round {r.roundNumber}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {r.matchCount} matches — starts {formatDate(r.firstMatch)}
                    </span>
                  </button>
                </div>

                {expandedRound === r.roundNumber && (
                  <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-zinc-500 dark:text-zinc-400">
                          <th className="py-1 text-left font-medium">Home</th>
                          <th className="py-1 text-left font-medium">Away</th>
                          <th className="py-1 text-left font-medium">Date</th>
                          <th className="py-1 text-left font-medium">Venue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.matches.map((m, i) => (
                          <tr key={i} className="text-zinc-700 dark:text-zinc-300">
                            <td className="py-1">{m.homeTeam}</td>
                            <td className="py-1">{m.awayTeam}</td>
                            <td className="py-1">{formatDate(m.dateUtc)}</td>
                            <td className="py-1">{m.venue || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        <button
          onClick={() => router.push('/admin')}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Back to Admin
        </button>
      </div>
    </div>
  )
}

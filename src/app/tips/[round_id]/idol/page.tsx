'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Team } from '@/lib/types'

export default function PlayIdolPage({
  params,
}: {
  params: Promise<{ round_id: string }>
}) {
  const { round_id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [idolCount, setIdolCount] = useState(0)
  const [mainTipTeam, setMainTipTeam] = useState<Team | null>(null)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [canPlay, setCanPlay] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [played, setPlayed] = useState(false)
  const [roundNumber, setRoundNumber] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
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
      setIdolCount(participant.idol_count)

      const { data: round } = await supabase
        .from('rounds')
        .select('round_number, has_main_tip')
        .eq('id', round_id)
        .single()

      if (round) setRoundNumber(round.round_number)

      // No idol play for rounds without main tips
      if (!round?.has_main_tip) {
        setLoading(false)
        return
      }

      const { data: mainTip } = await supabase
        .from('main_tips')
        .select('*, matches!inner(match_datetime)')
        .eq('participant_id', participant.id)
        .eq('round_id', round_id)
        .single()

      if (mainTip) {
        setAlreadyPlayed(mainTip.idol_played)

        const { data: team } = await supabase
          .from('teams')
          .select('*')
          .eq('id', mainTip.tipped_loser_team_id)
          .single()

        if (team) setMainTipTeam(team as Team)

        // Check Q2 deadline
        const matchData = mainTip.matches as { match_datetime: string | null }
        if (matchData.match_datetime) {
          const q2Time = new Date(matchData.match_datetime)
          q2Time.setMinutes(q2Time.getMinutes() + 30)
          setCanPlay(
            !mainTip.idol_played &&
              participant.idol_count > 0 &&
              !participant.is_eliminated &&
              new Date() < q2Time
          )
        } else {
          setCanPlay(
            !mainTip.idol_played &&
              participant.idol_count > 0 &&
              !participant.is_eliminated
          )
        }
      }

      setLoading(false)
    }
    load()
  }, [round_id])

  async function handlePlayIdol() {
    setConfirming(false)
    setError('')

    const res = await fetch('/api/tips/idol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round_id }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to play idol')
      return
    }

    setPlayed(true)
    setAlreadyPlayed(true)
    setIdolCount((c) => c - 1)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Play Idol — Round {roundNumber}
      </h1>

      {!mainTipTeam && !alreadyPlayed && !canPlay && (
        <div className="mb-6 rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          This round has no main tip — idols cannot be played.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Your idols</p>
        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {idolCount}
        </p>
      </div>

      {mainTipTeam && (
        <div className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your main tip this round
          </p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {mainTipTeam.short_name} to lose
          </p>
        </div>
      )}

      {played && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Idol played! Your main tip is protected this round.
        </div>
      )}

      {alreadyPlayed && !played && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
          You have already played an idol for this round.
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {canPlay && !played && (
        <>
          {confirming ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
              <p className="mb-3 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Use 1 idol to protect your main tip this round?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePlayIdol}
                  className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
                >
                  Confirm — Play Idol
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-lg bg-yellow-600 px-4 py-3 font-medium text-white hover:bg-yellow-700"
            >
              Play Idol
            </button>
          )}
        </>
      )}

      <div className="mt-6">
        <button
          onClick={() => router.push(`/tips/${round_id}`)}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          &larr; Back to tips
        </button>
      </div>
    </div>
  )
}

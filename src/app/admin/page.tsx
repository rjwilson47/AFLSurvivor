import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Get active season
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  // Get rounds for the active season
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('season_id', season?.id ?? '')
    .order('round_number', { ascending: true })

  // Get participant count
  const { count: participantCount } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season?.id ?? '')
    .eq('is_active', true)

  // Get tip submission counts per round (distinct participants who have tipped)
  const roundIds = rounds?.map((r: { id: string }) => r.id) ?? []
  const { data: tipCounts } = roundIds.length
    ? await supabase
        .from('main_tips')
        .select('round_id')
        .in('round_id', roundIds)
    : { data: [] }

  // Count main_tips per round (one main_tip = one participant has submitted)
  const tipCountByRound = new Map<string, number>()
  for (const tc of tipCounts ?? []) {
    tipCountByRound.set(tc.round_id, (tipCountByRound.get(tc.round_id) ?? 0) + 1)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Admin Dashboard
        </h1>
        <div className="flex gap-3">
          <Link
            href="/admin/rounds/import"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Import Fixture
          </Link>
          <Link
            href="/admin/rounds/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Round
          </Link>
          <Link
            href="/admin/participants"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Manage Participants
          </Link>
        </div>
      </div>

      {!season ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-yellow-800 dark:text-yellow-200">
            No active season found. Create a season in Supabase to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Season</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{season.year}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Participants</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{participantCount ?? 0}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Rounds</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{rounds?.length ?? 0}</p>
            </div>
          </div>

          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Rounds</h2>
          {rounds && rounds.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Round</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Deadline</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Tipped</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((round) => (
                    <tr key={round.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        Round {round.round_number}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {new Date(round.deadline).toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Australia/Melbourne',
                        })}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {tipCountByRound.get(round.id) ?? 0}/{participantCount ?? 0}
                      </td>
                      <td className="px-3 py-2">
                        {round.results_entered ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                            Results In
                          </span>
                        ) : round.is_locked ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/rounds/${round.id}/tips`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          >
                            Tips
                          </Link>
                          <Link
                            href={`/admin/rounds/${round.id}/results`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          >
                            Results
                          </Link>
                          <Link
                            href={`/admin/rounds/${round.id}/corner`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          >
                            Corner
                          </Link>
                          <Link
                            href={`/admin/rounds/${round.id}/edit`}
                            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400">
              No rounds created yet. Click &quot;New Round&quot; to get started.
            </p>
          )}
        </>
      )}
    </div>
  )
}

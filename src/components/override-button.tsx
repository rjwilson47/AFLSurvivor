'use client'

import { useState } from 'react'
import { OverrideDialog } from './override-dialog'
import type { Team, Match } from '@/lib/types'

export function OverrideButton({
  roundId,
  participantId,
  participantName,
  matchesJson,
  teamsJson,
}: {
  roundId: string
  participantId: string
  participantName: string
  matchesJson: string
  teamsJson: string
}) {
  const [open, setOpen] = useState(false)

  const matches = JSON.parse(matchesJson) as Match[]
  const teamsArray = JSON.parse(teamsJson) as Team[]
  const teamMap = new Map(teamsArray.map((t) => [t.id, t]))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
        title="Override tip"
      >
        Override
      </button>
      {open && (
        <OverrideDialog
          roundId={roundId}
          participantId={participantId}
          participantName={participantName}
          matches={matches}
          teams={teamMap}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

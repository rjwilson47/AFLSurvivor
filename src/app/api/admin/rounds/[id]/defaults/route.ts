import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, hasRole } from '@/lib/auth'

// Trigger default tip assignment for a round
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: roundId } = await params
  const admin = createAdminClient()

  const { error } = await admin.rpc('assign_round_defaults', {
    p_round_id: roundId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

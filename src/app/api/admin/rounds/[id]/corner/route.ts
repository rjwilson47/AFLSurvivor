import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, hasRole } from '@/lib/auth'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: roundId } = await params
  const { content } = (await request.json()) as { content: string }

  const supabase = await createClient()

  const { error } = await supabase
    .from('rounds')
    .update({
      mikes_corner: content || null,
      mikes_corner_posted_at: content ? new Date().toISOString() : null,
    })
    .eq('id', roundId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

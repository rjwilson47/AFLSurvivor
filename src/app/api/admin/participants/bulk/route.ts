import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, hasRole } from '@/lib/auth'

interface BulkParticipant {
  email: string
  display_name: string
  role?: 'participant' | 'admin' | 'superadmin'
  is_participating?: boolean
}

export async function POST(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { participants, season_id } = await request.json() as {
    participants: BulkParticipant[]
    season_id: string
  }

  if (!participants?.length || !season_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const supabase = await createClient()

  // Get existing auth users
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const usersByEmail = new Map(
    existingUsers?.users?.map((u) => [u.email?.toLowerCase(), u]) ?? []
  )

  // Get existing participants for this season
  const { data: existingParticipants } = await supabase
    .from('participants')
    .select('user_id')
    .eq('season_id', season_id)

  const existingUserIds = new Set(existingParticipants?.map((p) => p.user_id) ?? [])

  const results: { email: string; displayName: string; status: string }[] = []

  for (const p of participants) {
    const email = p.email.trim().toLowerCase()
    const displayName = p.display_name.trim()

    if (!email || !displayName) {
      results.push({ email, displayName, status: 'skipped (missing fields)' })
      continue
    }

    // Find or create auth user
    let authUser = usersByEmail.get(email)

    if (!authUser) {
      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (authError) {
        results.push({ email, displayName, status: `error: ${authError.message}` })
        continue
      }
      authUser = newUser.user
      usersByEmail.set(email, authUser)
    }

    // Check if already a participant this season
    if (existingUserIds.has(authUser.id)) {
      results.push({ email, displayName, status: 'skipped (already exists)' })
      continue
    }

    // Create participant record
    const insertData: Record<string, unknown> = {
      user_id: authUser.id,
      season_id,
      display_name: displayName,
      is_participating: p.is_participating !== false,
    }

    // Only superadmin can set roles
    if (p.role && p.role !== 'participant' && hasRole(role, 'superadmin')) {
      insertData.role = p.role
    }

    const { error: insertError } = await supabase
      .from('participants')
      .insert(insertData)

    if (insertError) {
      results.push({ email, displayName, status: `error: ${insertError.message}` })
      continue
    }

    existingUserIds.add(authUser.id)
    results.push({ email, displayName, status: 'created' })
  }

  return NextResponse.json({ results })
}

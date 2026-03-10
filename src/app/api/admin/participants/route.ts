import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, hasRole } from '@/lib/auth'

export async function POST(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email, display_name, season_id } = await request.json()

  if (!email || !display_name || !season_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const supabase = await createClient()

  // Check if auth user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  let authUser = existingUsers?.users?.find((u) => u.email === email)

  if (!authUser) {
    // Create auth user via admin API (no self-registration)
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    authUser = newUser.user
  }

  // Check if participant already exists for this season
  const { data: existing } = await supabase
    .from('participants')
    .select('id')
    .eq('user_id', authUser.id)
    .eq('season_id', season_id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Participant already exists for this season' },
      { status: 400 }
    )
  }

  // Create participant record
  const { data: participant, error: insertError } = await supabase
    .from('participants')
    .insert({
      user_id: authUser.id,
      season_id,
      display_name,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ participant })
}

export async function PUT(request: Request) {
  const role = await getUserRole()
  if (!hasRole(role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id, action, ...fields } = await request.json()

  const supabase = await createClient()

  if (action === 'grant_third_life') {
    // Use the database function for atomic third life grant
    const { error } = await supabase.rpc('grant_third_life', {
      p_participant_id: id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'toggle_active') {
    const { data: participant } = await supabase
      .from('participants')
      .select('is_active')
      .eq('id', id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('participants')
      .update({ is_active: !participant.is_active })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'toggle_participating') {
    const { data: participant } = await supabase
      .from('participants')
      .select('is_participating')
      .eq('id', id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('participants')
      .update({ is_participating: !participant.is_participating })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  // Whitelist allowed fields to prevent arbitrary updates
  const allowedFields: Record<string, string[]> = {
    admin: ['display_name'],
    superadmin: ['display_name', 'role'],
  }

  const permitted = allowedFields[role ?? ''] ?? []
  const sanitized: Record<string, unknown> = {}

  for (const key of Object.keys(fields)) {
    if (!permitted.includes(key)) {
      return NextResponse.json(
        { error: `Field '${key}' cannot be updated directly. Use a specific action instead.` },
        { status: 400 }
      )
    }
    sanitized[key] = fields[key]
  }

  // Role validation
  if ('role' in sanitized) {
    const validRoles = ['participant', 'admin', 'superadmin']
    if (!validRoles.includes(sanitized.role as string)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
  }

  // Apply whitelisted field updates
  if (Object.keys(sanitized).length > 0) {
    const { error } = await supabase
      .from('participants')
      .update(sanitized)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}

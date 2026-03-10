import { createClient } from '@/lib/supabase/server'
import type { ParticipantRole } from '@/lib/types'

// Get the current authenticated user, or null if not logged in
export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Get the current user's participant record (with role) for the active season
export async function getParticipant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('participants')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  return data
}

// Get role for the current user in the active season
export async function getUserRole(): Promise<ParticipantRole | null> {
  const participant = await getParticipant()
  return participant?.role ?? null
}

// Check if user has at least the required role level
export function hasRole(
  userRole: ParticipantRole | null,
  requiredRole: ParticipantRole
): boolean {
  if (!userRole) return false
  const hierarchy: ParticipantRole[] = ['participant', 'admin', 'superadmin']
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole)
}

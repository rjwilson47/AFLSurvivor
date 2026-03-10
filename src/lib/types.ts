// Database types matching the Supabase schema

export type ParticipantRole = 'participant' | 'admin' | 'superadmin'
export type MatchResult = 'home_win' | 'away_win' | 'draw' | 'pending'

export interface Team {
  id: string
  name: string
  short_name: string
  abbreviation: string
}

export interface Season {
  id: string
  year: number
  is_active: boolean
  entry_cost: number
  extra_life_cost: number
  created_at: string
}

export interface Participant {
  id: string
  user_id: string
  season_id: string
  display_name: string
  lives_total: number
  lives_remaining: number
  idol_count: number
  is_eliminated: boolean
  is_active: boolean
  is_participating: boolean
  role: ParticipantRole
  joined_at: string
}

// Public view — excludes role and idol_count
export interface ParticipantPublic {
  id: string
  user_id: string
  season_id: string
  display_name: string
  lives_total: number
  lives_remaining: number
  is_eliminated: boolean
  is_active: boolean
  is_participating: boolean
  joined_at: string
}

export interface Round {
  id: string
  season_id: string
  round_number: number
  deadline: string
  is_locked: boolean
  results_entered: boolean
  has_main_tip: boolean
  mikes_corner: string | null
  mikes_corner_posted_at: string | null
  created_at: string
}

export interface Match {
  id: string
  round_id: string
  home_team_id: string
  away_team_id: string
  match_datetime: string | null
  venue: string | null
  result: MatchResult
  winner_team_id: string | null
  loser_team_id: string | null
  is_final_match: boolean
  created_at: string
}

export interface Tip {
  id: string
  participant_id: string
  round_id: string
  match_id: string
  tipped_loser_team_id: string
  is_correct: boolean | null
  submitted_at: string
}

export interface MainTip {
  id: string
  participant_id: string
  round_id: string
  match_id: string
  tipped_loser_team_id: string
  is_correct: boolean | null
  idol_played: boolean
  idol_played_at: string | null
  was_default_assigned: boolean
  submitted_at: string
}

export interface MainTipTeamUsage {
  id: string
  participant_id: string
  season_id: string
  team_id: string
  times_used: number
}

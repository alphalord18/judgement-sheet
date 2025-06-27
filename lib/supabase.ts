import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Event = {
  id: number
  name: string
  description: string
  date: string
  is_active: boolean
  rounds: number
  is_locked?: boolean
  locked_by?: string
  locked_at?: string
}

export type JudgmentCriteria = {
  id: number
  event_id: number
  criteria_name: string
  max_marks: number
}

export type Participant = {
  id: number
  event_id: number
  name: string
  school_code: string
  team_id: string
  solo_marking: boolean
  class?: string
  scholar_number?: string
  category?: string
}

export type Mark = {
  id: number
  event_id: number
  participant_id: number
  criteria_id: number
  marks_obtained: number
  round_number: number
}

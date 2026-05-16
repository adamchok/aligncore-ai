export type LifecycleState = 'ACTIVE' | 'AT_RISK' | 'PAUSED' | 'COMPLETED' | 'DROPPED'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'

export interface Mentor {
  id: string
  name: string
  bio: string
  expertise: string[]
  industry?: string
  industries?: string[]
  available: boolean
  created_at?: string
}

export interface Company {
  id: string
  name: string
  industry: string
  stage: string
  problem?: string
  goals?: string
  size?: string
  created_at?: string
}

export interface HealthHistory {
  id: string
  score: number
  sentiment: Sentiment
  timestamp: string
}

export interface RelationshipEntity {
  id: string
  mentor_id: string
  company_id: string
  mentor_name?: string
  company_name?: string
  lifecycle: LifecycleState
  engagement: {
    health_score: number
    sessions_completed: number
    next_session?: string
  }
  comms: {
    last_sentiment?: Sentiment | null
    last_message_text?: string | null
    last_message_preview?: string | null
    last_wa_at?: string | null
  }
  ai_summary?: string | null
  ai_summary_updated_at?: string | null
  match_score?: number
  match_reasoning?: string
  created_at: string
  updated_at: string
}

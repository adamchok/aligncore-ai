export type LifecycleState = 'ACTIVE' | 'AT_RISK' | 'PAUSED' | 'COMPLETED' | 'DROPPED'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'

export type ActivityType =
  | 'COMPANY_CREATED'
  | 'COMPANY_UPDATED'
  | 'COMPANY_DELETED'
  | 'MENTOR_CREATED'
  | 'MENTOR_UPDATED'
  | 'RELATIONSHIP_CREATED'
  | 'RELATIONSHIP_UPDATED'
  | 'RELATIONSHIP_DELETED'
  | 'HEALTH_UPDATED'
  | 'SUMMARY_GENERATED'
  | 'ONBOARDING_COMPLETE'
  | 'LIFECYCLE_CHANGED'
  | 'CSV_IMPORT'
  | 'AI_EXTRACT'
  | 'WHATSAPP_MESSAGE'
  | 'WHATSAPP_GROUP_CREATED'
  | 'KNOWLEDGE_UPLOADED'

export interface ActivityEntry {
  id: string
  type: ActivityType
  entity_type: 'company' | 'mentor' | 'relationship' | 'onboarding' | 'system'
  entity_id: string
  entity_name: string
  detail: string
  timestamp: string
}

export interface CompanyCSVRow {
  name: string
  industry: string
  stage: string
  /** Product / mission overview — what the company does */
  about?: string
  problem?: string
  goals?: string
  size?: string
}

export interface Mentor {
  id: string
  name: string
  bio: string
  expertise: string[]
  industry?: string
  industries?: string[]
  available: boolean
  whatsapp_number?: string
  /** Public URL from Firebase Storage or CDN */
  photo_url?: string
  /** Denormalized count from knowledge uploads (mentors only); optional on legacy docs */
  knowledge_doc_count?: number
  created_at?: string
  updated_at?: string
}

export interface Company {
  id: string
  name: string
  industry: string
  stage: string
  /** What the company builds / does — elevator pitch & context */
  about?: string
  problem?: string
  goals?: string
  size?: string
  whatsapp_number?: string
  photo_url?: string
  knowledge_doc_count?: number
  created_at?: string
  updated_at?: string
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
  /** Manual WhatsApp group id (e.g. …@g.us). Usually set automatically when phones exist. */
  wa_group_id?: string | null
  mentor_phone?: string
  company_phone?: string
  /** Operator notes — internal context not tied to WhatsApp automation */
  notes?: string | null
  created_at: string
  updated_at: string
}

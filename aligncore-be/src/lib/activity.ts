import type { Firestore } from 'firebase-admin/firestore'

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
  type: ActivityType
  entity_type: 'company' | 'mentor' | 'relationship' | 'onboarding' | 'system'
  entity_id: string
  entity_name: string
  detail: string
  timestamp: string
}

export async function logActivity(
  db: Firestore,
  entry: Omit<ActivityEntry, 'timestamp'>
): Promise<void> {
  try {
    await db.collection('activity_log').add({
      ...entry,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // never let logging block the main request path
  }
}

import { FunctionTool } from '@google/adk'
import { z } from 'zod'
import { adminDb } from '../firebase-admin'

export const getRelationshipHistory = new FunctionTool({
  name: 'getRelationshipHistory',
  description: 'Fetch a mentor-company relationship and its last 10 health history entries.',
  parameters: z.object({
    relationship_id: z.string().describe('Firestore document ID of the relationship'),
  }),
  execute: async ({ relationship_id }) => {
    const reSnap = await adminDb.collection('relationships').doc(relationship_id).get()
    if (!reSnap.exists) return { relationship: null, history: [] }

    const re = reSnap.data()!
    const histSnap = await adminDb
      .collection('relationships')
      .doc(relationship_id)
      .collection('history')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get()

    const history = histSnap.docs.map(d => ({
      score: d.data().score,
      sentiment: d.data().sentiment,
      timestamp: d.data().timestamp,
    }))

    return {
      relationship: {
        company_name: re.company_name ?? re.company_id,
        mentor_name: re.mentor_name ?? re.mentor_id,
        lifecycle: re.lifecycle,
        health_score: Math.round((re.engagement?.health_score ?? 0.5) * 100),
        last_sentiment: re.comms?.last_sentiment ?? 'N/A',
        last_message: re.comms?.last_message_text ?? 'No messages yet',
        notes: (re.notes as string | undefined)?.trim() || null,
        wa_group_id: re.wa_group_id ?? null,
      },
      history,
    }
  },
})

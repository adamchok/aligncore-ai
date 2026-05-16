import { FunctionTool } from '@google/adk'
import { z } from 'zod'
import { adminDb } from '../firebase-admin'

const MAX_TEXT_PER_DOC = 3000

export const getEntityKnowledge = new FunctionTool({
  name: 'getEntityKnowledge',
  description:
    'Retrieve uploaded knowledge documents (pitch decks, CVs, financials, etc.) for a company or mentor. ' +
    'Returns the extracted text content of each document.',
  parameters: z.object({
    entity_type: z.enum(['company', 'mentor']).describe('Whether this is a company or mentor'),
    entity_id: z.string().describe('Firestore document ID of the company or mentor'),
  }),
  execute: async ({ entity_type, entity_id }) => {
    const snap = await adminDb
      .collection('knowledge_docs')
      .where('entity_type', '==', entity_type)
      .where('entity_id', '==', entity_id)
      .orderBy('uploaded_at', 'desc')
      .limit(5)
      .get()

    const documents = snap.docs.map(d => {
      const data = d.data()
      return {
        filename: data.filename as string,
        text: (data.extracted_text as string ?? '').slice(0, MAX_TEXT_PER_DOC),
        uploaded_at: data.uploaded_at as string,
      }
    })

    return { documents }
  },
})

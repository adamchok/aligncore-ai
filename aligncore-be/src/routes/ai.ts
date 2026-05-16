import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { generateText } from '../lib/ai'
import { logActivity } from '../lib/activity'

export const aiRouter = Router()

aiRouter.post('/summary/:reId', async (req, res) => {
  try {
    const { reId } = req.params

    const reSnap = await adminDb.collection('relationships').doc(reId).get()
    if (!reSnap.exists) {
      return res.status(404).json({ error: 'Relationship not found' })
    }

    const re = reSnap.data()!
    const historySnap = await adminDb
      .collection('relationships')
      .doc(reId)
      .collection('history')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get()

    const historyPoints = historySnap.docs.map((d) => d.data())

    const prompt = `
You are AlignCore AI, an ecosystem relationship manager.

Summarize the current state of this mentor-company relationship in 2-3 sentences.
Be concise, data-driven, and actionable. Focus on health trends and next steps.

Relationship data:
- Company: ${re.company_name ?? re.company_id}
- Mentor: ${re.mentor_name ?? re.mentor_id}
- Lifecycle: ${re.lifecycle}
- Health Score: ${Math.round((re.engagement?.health_score ?? 0) * 100)}/100
- Sessions Completed: ${re.engagement?.sessions_completed ?? 0}
- Last Sentiment: ${re.comms?.last_sentiment ?? 'N/A'}
- Last Message: ${re.comms?.last_message_text ?? 'No messages yet'}
- Recent Health History (newest first): ${historyPoints
      .map((h) => `${Math.round(h.score * 100)} (${h.sentiment})`)
      .join(', ') || 'No history'}

Write the summary now (no markdown, no headings):
`

    const summary = await generateText(prompt)

    const now = new Date().toISOString()
    await adminDb.collection('relationships').doc(reId).update({
      ai_summary: summary.trim(),
      ai_summary_updated_at: now,
      updated_at: now,
    })

    await logActivity(adminDb, {
      type: 'SUMMARY_GENERATED',
      entity_type: 'relationship',
      entity_id: reId,
      entity_name: `${re.company_name ?? re.company_id} ↔ ${re.mentor_name ?? re.mentor_id}`,
      detail: 'AI summary generated for relationship',
    })

    return res.json({ summary: summary.trim() })
  } catch (err) {
    console.error('[ai] POST /summary/:reId:', err)
    return res.status(500).json({ error: String(err) })
  }
})

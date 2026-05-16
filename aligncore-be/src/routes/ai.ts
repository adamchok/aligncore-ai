import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { runAgent } from '../lib/adk'
import { summaryAgent } from '../lib/agents/summaryAgent'
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

    // Agent fetches all data via tools; pass only the IDs it needs
    const prompt = [
      `relationship_id: ${reId}`,
      re.company_id ? `company_id: ${re.company_id}` : null,
      re.mentor_id ? `mentor_id: ${re.mentor_id}` : null,
    ].filter(Boolean).join('\n')

    const summary = await runAgent(summaryAgent, prompt)

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

import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'

export const demoRouter = Router()

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'
const RE_REF = () => adminDb.collection('relationships').doc(DEMO_RE_ID)

function previewFromFull(text: string): string {
  if (text.length <= 120) return text
  return `${text.slice(0, 117)}...`
}

async function updateRE(sentiment: string, healthScore: number, lastMessage: string): Promise<void> {
  await RE_REF().update({
    'comms.last_sentiment': sentiment,
    'engagement.health_score': healthScore,
    'comms.last_message_text': lastMessage,
    'comms.last_message_preview': previewFromFull(lastMessage),
    updated_at: new Date().toISOString(),
  })
}

demoRouter.get('/simulate-positive', async (_req, res) => {
  try {
    await updateRE(
      'POSITIVE',
      0.87,
      'Had a great session with the mentor yesterday — very helpful!'
    )
    res.json({ ok: true, sentiment: 'POSITIVE', health_score: 0.87 })
  } catch (err) {
    console.error('[demo] simulate-positive error:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

demoRouter.get('/simulate-negative', async (_req, res) => {
  try {
    await updateRE(
      'NEGATIVE',
      0.31,
      "Haven't heard back from the mentor in two weeks. Feeling stuck."
    )
    res.json({ ok: true, sentiment: 'NEGATIVE', health_score: 0.31 })
  } catch (err) {
    console.error('[demo] simulate-negative error:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

demoRouter.get('/reset', async (_req, res) => {
  try {
    await RE_REF().update({
      'comms.last_sentiment': null,
      'comms.last_message_text': null,
      'comms.last_message_preview': null,
      'engagement.health_score': 0.72,
      updated_at: new Date().toISOString(),
    })
    res.json({ ok: true, reset: true, health_score: 0.72 })
  } catch (err) {
    console.error('[demo] reset error:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

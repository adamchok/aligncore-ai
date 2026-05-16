import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { generateText } from '../lib/gemini'

export const wahaRouter = Router()

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'

interface WAHAPayload {
  event: string
  payload?: {
    body?: string
    from?: string
    timestamp?: number
  }
}

wahaRouter.post('/webhook', async (req, res) => {
  try {
    const body = req.body as WAHAPayload

    // Only process inbound message events
    if (body.event !== 'message' || !body.payload?.body) {
      return res.json({ ok: true, skipped: true })
    }

    const messageText = body.payload.body

    // ── Sentiment Analysis via Gemini ─────────────────────────────────────
    const sentimentPrompt = `
Analyze the sentiment of this WhatsApp message from a mentee about their mentor relationship.
Reply with JSON only, no markdown:
{ "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE", "health_score_delta": number }

Rules:
- health_score_delta ranges from -0.3 to +0.3
- POSITIVE messages should have +0.05 to +0.15 delta
- NEGATIVE messages should have -0.1 to -0.3 delta
- NEUTRAL messages should have -0.02 to +0.02 delta

Message: "${messageText.replace(/"/g, "'")}"
`

    const raw = await generateText(sentimentPrompt)
    let sentiment = 'NEUTRAL'
    let delta = 0

    try {
      // Strip possible markdown fences
      const clean = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean) as { sentiment: string; health_score_delta: number }
      sentiment = parsed.sentiment ?? 'NEUTRAL'
      delta = parsed.health_score_delta ?? 0
    } catch {
      console.warn('[waha] Failed to parse Gemini sentiment response, defaulting to NEUTRAL')
    }

    // ── Update Firestore RE ──────────────────────────────────────────────
    const reRef = adminDb.collection('relationships').doc(DEMO_RE_ID)
    const snap = await reRef.get()
    const current = snap.data()
    const currentHealth: number = current?.engagement?.health_score ?? 0.5

    const newHealth = Math.min(1, Math.max(0, currentHealth + delta))

    await reRef.update({
      'comms.last_sentiment': sentiment,
      'comms.last_message_preview': messageText.slice(0, 120),
      'comms.last_wa_at': new Date().toISOString(),
      'engagement.health_score': newHealth,
      updated_at: new Date().toISOString(),
    })

    console.log(`[waha] ${sentiment} | delta=${delta} | health=${newHealth.toFixed(2)}`)
    return res.json({ ok: true, sentiment, health_score: newHealth })
  } catch (err) {
    console.error('[waha] webhook error:', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
})

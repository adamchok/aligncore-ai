import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { generateText } from '../lib/gemini'

export const wahaRouter = Router()

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'
const WAHA_URL = process.env.WAHA_URL ?? 'http://localhost:3000'
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'default'
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''

function wahaHeaders(): Record<string, string> {
  return WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}
}

// ── WAHA Proxy endpoints ─────────────────────────────────────────────────────

wahaRouter.get('/session', async (_req, res) => {
  try {
    const r = await fetch(`${WAHA_URL}/api/sessions/${WAHA_SESSION}`, {
      headers: wahaHeaders(),
    })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
})

wahaRouter.get('/qr', async (_req, res) => {
  try {
    const r = await fetch(
      `${WAHA_URL}/api/${WAHA_SESSION}/auth/qr?format=image`,
      { headers: wahaHeaders() }
    )
    if (!r.ok) return res.json({ qr: null, status: 'unavailable' })
    const contentType = r.headers.get('content-type') ?? ''
    if (contentType.includes('image')) {
      const buf = Buffer.from(await r.arrayBuffer())
      const qr = `data:${contentType};base64,${buf.toString('base64')}`
      return res.json({ qr, status: 'SCAN_QR_CODE' })
    }
    const data = await r.json() as { qr?: string; status?: string }
    return res.json({ qr: data.qr ?? null, status: data.status ?? 'SCAN_QR_CODE' })
  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
})

wahaRouter.post('/session/start', async (_req, res) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...wahaHeaders() }
    const r = await fetch(`${WAHA_URL}/api/sessions/${WAHA_SESSION}/start`, {
      method: 'POST',
      headers,
    })
    const data = await r.json() as Record<string, unknown>
    return res.status(r.status).json({ ok: r.ok, ...data })
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err) })
  }
})

wahaRouter.post('/session/restart', async (_req, res) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...wahaHeaders() }
    const r = await fetch(`${WAHA_URL}/api/sessions/${WAHA_SESSION}/restart`, {
      method: 'POST',
      headers,
    })
    const data = await r.json() as Record<string, unknown>
    return res.status(r.status).json({ ok: r.ok, ...data })
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err) })
  }
})

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

    if (body.event !== 'message') {
      return res.json({ ok: true, skipped: true })
    }

    const messageText = body.payload?.body ?? ''
    const fromNumber = body.payload?.from ?? ''

    if (!messageText.trim()) {
      return res.json({ ok: true, skipped: 'empty message' })
    }

    if (fromNumber) {
      console.log(`[waha] inbound from ${fromNumber}`)
    }

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
      const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean) as { sentiment: string; health_score_delta: number }
      sentiment = parsed.sentiment ?? 'NEUTRAL'
      delta = parsed.health_score_delta ?? 0
    } catch {
      console.warn('[waha] Failed to parse Gemini sentiment response, defaulting to NEUTRAL')
    }

    const reRef = adminDb.collection('relationships').doc(DEMO_RE_ID)
    const snap = await reRef.get()

    if (!snap.exists) {
      console.warn('[waha] Relationship doc missing:', DEMO_RE_ID)
      return res.status(404).json({ ok: false, error: 'RE not found' })
    }

    const currentHealth: number = snap.data()?.engagement?.health_score ?? 0.5
    const newHealth = Math.min(1, Math.max(0, currentHealth + delta))

    const preview =
      messageText.length <= 120 ? messageText : `${messageText.slice(0, 117)}...`
    const textField = messageText.length <= 200 ? messageText : `${messageText.slice(0, 197)}...`

    await reRef.update({
      'comms.last_sentiment': sentiment,
      'comms.last_message_text': textField,
      'comms.last_message_preview': preview,
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

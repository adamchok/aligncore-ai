import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { generateText } from '../lib/ai'
import { logActivity } from '../lib/activity'

export const wahaRouter = Router()

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'
const WAHA_URL = process.env.WAHA_URL ?? 'http://localhost:3000'
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'default'
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''

function wahaHeaders(): Record<string, string> {
  return WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}
}

// ── Phone helpers ─────────────────────────────────────────────────────────────

/**
 * Normalize a WhatsApp JID or user-entered number to digits only.
 * WAHA sends "60123456789@c.us" — strips the suffix and all non-digits.
 * Users may enter "+60123456789" — strips the leading +.
 */
export function normalizePhone(raw: string): string {
  return raw.split('@')[0].replace(/\D/g, '')
}

/**
 * Given a normalized phone number, find the matching active relationship.
 * Checks companies first, then mentors.
 * Returns null if no linked entity or no active relationship found.
 */
async function findRelationshipByPhone(phone: string): Promise<{
  reId: string
  side: 'company' | 'mentor'
  entityName: string
} | null> {
  if (!phone) return null

  const ACTIVE = new Set(['ACTIVE', 'AT_RISK', 'PAUSED'])

  // ── Check companies ──────────────────────────────────────────────────────
  const compSnap = await adminDb
    .collection('companies')
    .where('whatsapp_number', '==', phone)
    .limit(1)
    .get()

  if (!compSnap.empty) {
    const compDoc = compSnap.docs[0]
    const compId = compDoc.id
    const compName = (compDoc.data().name as string) || compId

    const reSnap = await adminDb
      .collection('relationships')
      .where('company_id', '==', compId)
      .get()

    const activeRe = reSnap.docs
      .filter((d) => ACTIVE.has(d.data().lifecycle))
      .sort((a, b) =>
        (b.data().updated_at ?? '').localeCompare(a.data().updated_at ?? '')
      )[0]

    if (activeRe) {
      return { reId: activeRe.id, side: 'company', entityName: compName }
    }
  }

  // ── Check mentors ────────────────────────────────────────────────────────
  const mentorSnap = await adminDb
    .collection('mentors')
    .where('whatsapp_number', '==', phone)
    .limit(1)
    .get()

  if (!mentorSnap.empty) {
    const mentorDoc = mentorSnap.docs[0]
    const mentorId = mentorDoc.id
    const mentorName = (mentorDoc.data().name as string) || mentorId

    const reSnap = await adminDb
      .collection('relationships')
      .where('mentor_id', '==', mentorId)
      .get()

    const activeRe = reSnap.docs
      .filter((d) => ACTIVE.has(d.data().lifecycle))
      .sort((a, b) =>
        (b.data().updated_at ?? '').localeCompare(a.data().updated_at ?? '')
      )[0]

    if (activeRe) {
      return { reId: activeRe.id, side: 'mentor', entityName: mentorName }
    }
  }

  return null
}

// ── Group management ─────────────────────────────────────────────────────────

/**
 * Create a WhatsApp group with the given participants and return its JID.
 * The WAHA host account (supervisor) is added automatically as group admin.
 * Participants are normalized phone numbers, e.g. '60123456789'.
 */
export async function createWAGroup(
  name: string,
  participantPhones: string[],
): Promise<string | null> {
  try {
    const participants = participantPhones
      .filter(Boolean)
      .map((p) => ({ id: `${p}@c.us` }))

    if (participants.length === 0) return null

    const r = await fetch(`${WAHA_URL}/api/${WAHA_SESSION}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...wahaHeaders() },
      body: JSON.stringify({ name, participants }),
    })

    if (!r.ok) {
      console.warn('[waha] createWAGroup failed:', r.status, await r.text())
      return null
    }

    const data = await r.json() as { gid?: { _serialized?: string } }
    return data.gid?._serialized ?? null
  } catch (e) {
    console.warn('[waha] createWAGroup error:', e)
    return null
  }
}

// ── WAHA Proxy endpoints ─────────────────────────────────────────────────────

wahaRouter.get('/session/me', async (_req, res) => {
  try {
    const r = await fetch(`${WAHA_URL}/api/sessions/${WAHA_SESSION}/me`, {
      headers: wahaHeaders(),
    })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
})

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
      method: 'POST', headers,
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
      method: 'POST', headers,
    })
    const data = await r.json() as Record<string, unknown>
    return res.status(r.status).json({ ok: r.ok, ...data })
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err) })
  }
})

// ── Webhook ───────────────────────────────────────────────────────────────────

interface WAHAPayload {
  event: string
  payload?: {
    body?: string
    from?: string
    participant?: string  // sender JID inside a group message
    fromMe?: boolean      // true when the WAHA host (supervisor) sent the message
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
    const rawFrom = body.payload?.from ?? ''

    if (!messageText.trim()) {
      return res.json({ ok: true, skipped: 'empty message' })
    }

    // Skip messages sent by the supervisor (WAHA host) to avoid self-feedback loops
    if (body.payload?.fromMe) {
      return res.json({ ok: true, skipped: 'own message' })
    }

    // ── Resolve relationship ──────────────────────────────────────────────
    // Group messages: match by wa_group_id stored on the relationship doc.
    // Direct messages: fall back to phone-number lookup (legacy / demo path).
    let reId = DEMO_RE_ID
    let senderSide: 'company' | 'mentor' | 'unknown' = 'unknown'
    let senderName = 'Unknown'
    let resolved = false

    const isGroupMsg = rawFrom.endsWith('@g.us')

    if (isGroupMsg) {
      const groupSnap = await adminDb
        .collection('relationships')
        .where('wa_group_id', '==', rawFrom)
        .limit(1)
        .get()

      if (!groupSnap.empty) {
        const reDoc = groupSnap.docs[0]
        reId = reDoc.id
        resolved = true
        const reData = reDoc.data()
        const senderPhone = normalizePhone(body.payload?.participant ?? '')

        if (senderPhone && senderPhone === reData.mentor_phone) {
          senderSide = 'mentor'
          senderName = reData.mentor_name || 'Mentor'
        } else if (senderPhone && senderPhone === reData.company_phone) {
          senderSide = 'company'
          senderName = reData.company_name || 'Company'
        }
        console.log(`[waha] group ${rawFrom} → RE ${reId} | sender=${senderSide} (${senderPhone})`)
      } else {
        console.warn(`[waha] No relationship found for group ${rawFrom} — falling back to DEMO_RE_ID`)
      }
    } else {
      const phone = normalizePhone(rawFrom)
      if (phone) {
        const found = await findRelationshipByPhone(phone)
        if (found) {
          reId = found.reId
          senderSide = found.side
          senderName = found.entityName
          resolved = true
          console.log(`[waha] ${phone} → ${senderSide} "${senderName}" → RE ${reId}`)
        } else {
          console.warn(`[waha] No relationship found for ${phone} — falling back to DEMO_RE_ID`)
        }
      }
    }

    // ── Sentiment analysis ────────────────────────────────────────────────
    const senderLabel =
      senderSide === 'company' ? 'company representative (mentee)'
      : senderSide === 'mentor' ? 'mentor'
      : 'participant'

    const sentimentPrompt = `
Analyze the sentiment of this WhatsApp message from a ${senderLabel} in a mentorship relationship.
Reply with JSON only, no markdown:
{ "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE", "health_score_delta": number }

Rules:
- health_score_delta ranges from -0.3 to +0.3
- POSITIVE: +0.05 to +0.15 delta
- NEGATIVE: -0.1 to -0.3 delta
- NEUTRAL: -0.02 to +0.02 delta

Message: "${messageText.replace(/"/g, "'").slice(0, 500)}"
`

    const raw = await generateText(sentimentPrompt)
    let sentiment = 'NEUTRAL'
    let delta = 0

    try {
      const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean) as { sentiment: string; health_score_delta: number }
      sentiment = parsed.sentiment ?? 'NEUTRAL'
      delta = Number(parsed.health_score_delta) || 0
    } catch {
      console.warn('[waha] Failed to parse sentiment response, defaulting to NEUTRAL')
    }

    // ── Update relationship ───────────────────────────────────────────────
    const reRef = adminDb.collection('relationships').doc(reId)
    const snap = await reRef.get()

    if (!snap.exists) {
      console.warn('[waha] Relationship doc not found:', reId)
      return res.status(404).json({ ok: false, error: 'Relationship not found' })
    }

    const reData = snap.data()!
    const currentHealth: number = reData.engagement?.health_score ?? 0.5
    const newHealth = Math.min(1, Math.max(0, currentHealth + delta))
    const now = new Date().toISOString()

    const preview = messageText.length <= 120 ? messageText : `${messageText.slice(0, 117)}…`
    const textField = messageText.length <= 200 ? messageText : `${messageText.slice(0, 197)}…`

    await reRef.update({
      'comms.last_sentiment': sentiment,
      'comms.last_message_text': textField,
      'comms.last_message_preview': preview,
      'comms.last_wa_at': now,
      'engagement.health_score': newHealth,
      updated_at: now,
    })

    // Append health history point
    await reRef.collection('history').add({ score: newHealth, sentiment, timestamp: now })

    const companyLabel = reData.company_name || reData.company_id || 'Company'
    const mentorLabel = reData.mentor_name || reData.mentor_id || 'Mentor'

    await logActivity(adminDb, {
      type: 'WHATSAPP_MESSAGE',
      entity_type: 'relationship',
      entity_id: reId,
      entity_name: `${companyLabel} ↔ ${mentorLabel}`,
      detail: `${sentiment} message from ${senderSide === 'unknown' ? rawFrom || 'unknown' : senderName} · health ${Math.round(currentHealth * 100)} → ${Math.round(newHealth * 100)}`,
    })

    console.log(`[waha] ${sentiment} | delta=${delta} | health=${newHealth.toFixed(2)} | resolved=${resolved}`)
    return res.json({ ok: true, sentiment, health_score: newHealth, resolved, relationship_id: reId })
  } catch (err) {
    console.error('[waha] webhook error:', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
})

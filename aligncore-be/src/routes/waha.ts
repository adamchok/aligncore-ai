import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { runAgent } from '../lib/adk'
import { wahaAgent } from '../lib/agents/wahaAgent'
import { logActivity } from '../lib/activity'

export const wahaRouter = Router()

const WAHA_URL = process.env.WAHA_URL ?? 'http://localhost:3000'
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'default'
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''

function wahaHeaders(): Record<string, string> {
  return WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}
}

/** Normalize WAHA group row shapes (engine-dependent `id` / subject fields). */
function parseWahaGroupId(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && '_serialized' in raw) {
    const s = (raw as { _serialized?: string })._serialized
    return typeof s === 'string' ? s : ''
  }
  return ''
}

function normalizeWahaGroupRow(row: unknown): { id: string; name: string } | null {
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  const id = parseWahaGroupId(o.id)
  if (!id.endsWith('@g.us')) return null
  const subject =
    typeof o.subject === 'string'
      ? o.subject.trim()
      : typeof o.name === 'string'
        ? o.name.trim()
        : ''
  const name = subject || id
  return { id, name }
}

function coerceJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.groups)) return o.groups
    if (Array.isArray(o.chats)) return o.chats
    if (Array.isArray(o.data)) return o.data
  }
  return []
}

function dedupeGroups(list: { id: string; name: string }[]): { id: string; name: string }[] {
  const seen = new Set<string>()
  const out: { id: string; name: string }[] = []
  for (const g of list) {
    if (seen.has(g.id)) continue
    seen.add(g.id)
    out.push(g)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Pull group JIDs + labels from WAHA (groups API, then chats/overview fallback). */
async function fetchWahaGroupChats(): Promise<{ id: string; name: string }[]> {
  const qsGroups = new URLSearchParams({
    limit: '400',
    sortBy: 'subject',
    sortOrder: 'asc',
    exclude: 'participants',
  })
  const r1 = await fetch(`${WAHA_URL}/api/${WAHA_SESSION}/groups?${qsGroups}`, {
    headers: wahaHeaders(),
  })
  const raw1: unknown = await r1.json().catch(() => null)
  if (r1.ok) {
    const fromGroups = coerceJsonArray(raw1)
      .map(normalizeWahaGroupRow)
      .filter(Boolean) as { id: string; name: string }[]
    if (fromGroups.length > 0) return dedupeGroups(fromGroups)
  }

  const qsOverview = new URLSearchParams({
    limit: '500',
    sortBy: 'messageTimestamp',
    sortOrder: 'desc',
  })
  const r2 = await fetch(`${WAHA_URL}/api/${WAHA_SESSION}/chats/overview?${qsOverview}`, {
    headers: wahaHeaders(),
  })
  const raw2: unknown = await r2.json().catch(() => null)
  if (!r2.ok) {
    const hint =
      typeof raw2 === 'object' && raw2 && 'message' in raw2
        ? String((raw2 as { message?: unknown }).message)
        : JSON.stringify(raw2)
    throw new Error(`WAHA groups ${r1.status}, chats/overview ${r2.status}: ${hint}`)
  }
  const fromOverview = coerceJsonArray(raw2)
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const o = row as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : ''
      if (!id.endsWith('@g.us')) return null
      const nm = typeof o.name === 'string' ? o.name.trim() : ''
      return { id, name: nm || id }
    })
    .filter(Boolean) as { id: string; name: string }[]

  return dedupeGroups(fromOverview)
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
export interface CreateWAGroupResult {
  /** Present when WAHA returns the group JID immediately (some engines). */
  jid: string | null
  /**
   * GOWS / async flows may return a create key first; `group.v2.join` echoes it in `_data.CreateKey`.
   * Stored on `relationships.wa_group_pending_create_key` until the webhook assigns `wa_group_id`.
   */
  createKey: string | null
}

function parseCreateGroupResponse(raw: unknown): CreateWAGroupResult {
  if (!raw || typeof raw !== 'object') return { jid: null, createKey: null }
  const data = raw as Record<string, unknown>

  let jid: string | null = null
  const gid = data.gid
  if (gid && typeof gid === 'object') {
    const ser = (gid as { _serialized?: string })._serialized
    if (typeof ser === 'string' && ser.endsWith('@g.us')) jid = ser
  }
  if (!jid && typeof data.id === 'string' && data.id.endsWith('@g.us')) jid = data.id
  if (!jid && typeof data.JID === 'string' && data.JID.trim().endsWith('@g.us')) {
    jid = data.JID.trim()
  }

  let createKey: string | null = null
  if (typeof data.createKey === 'string' && data.createKey.trim()) createKey = data.createKey.trim()
  else if (typeof data.CreateKey === 'string' && data.CreateKey.trim()) createKey = data.CreateKey.trim()
  const nested = data._data
  if (!createKey && nested && typeof nested === 'object') {
    const ck = (nested as { CreateKey?: string }).CreateKey
    if (typeof ck === 'string' && ck.trim()) createKey = ck.trim()
  }

  return { jid, createKey }
}

export async function createWAGroup(
  name: string,
  participantPhones: string[],
): Promise<CreateWAGroupResult> {
  try {
    const participants = participantPhones
      .filter(Boolean)
      .map((p) => ({ id: `${p}@c.us` }))

    if (participants.length === 0) return { jid: null, createKey: null }

    const r = await fetch(`${WAHA_URL}/api/${WAHA_SESSION}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...wahaHeaders() },
      body: JSON.stringify({ name, participants }),
    })

    const text = await r.text()
    let rawJson: unknown = null
    try {
      rawJson = text ? JSON.parse(text) : null
    } catch {
      rawJson = null
    }

    if (!r.ok) {
      console.warn('[waha] createWAGroup failed:', r.status, text)
      return { jid: null, createKey: null }
    }

    const parsed = parseCreateGroupResponse(rawJson)
    if (!parsed.jid && !parsed.createKey) {
      console.warn('[waha] createWAGroup: OK response but no jid/createKey:', text.slice(0, 500))
    }
    return parsed
  } catch (e) {
    console.warn('[waha] createWAGroup error:', e)
    return { jid: null, createKey: null }
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

/** WhatsApp group chats for the linked WAHA session (`…@g.us`), for linking `relationships.wa_group_id`. */
wahaRouter.get('/group-chats', async (_req, res) => {
  try {
    const groups = await fetchWahaGroupChats()
    return res.json({ groups })
  } catch (err) {
    console.warn('[waha] GET /group-chats:', err)
    return res.status(200).json({
      groups: [] as { id: string; name: string }[],
      error: String(err),
    })
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
    group?: { id?: string; subject?: string }
    _data?: { CreateKey?: string; Type?: string }
  }
}

/** Link async-created WhatsApp groups to relationships (see `wa_group_pending_*` on POST /relationships). */
async function assignWaGroupFromGroupJoinEvent(webhookBody: Record<string, unknown>): Promise<{
  ok: boolean
  relationship_id?: string
  skipped?: string
}> {
  const payload = webhookBody.payload as WAHAPayload['payload'] | undefined
  const group = payload?.group
  const gid = typeof group?.id === 'string' ? group.id.trim() : ''
  const subject = typeof group?.subject === 'string' ? group.subject.trim() : ''
  const createKey =
    typeof payload?._data?.CreateKey === 'string' ? payload._data.CreateKey.trim() : ''
  const joinType = typeof payload?._data?.Type === 'string' ? payload._data.Type : ''

  if (!gid.endsWith('@g.us')) {
    return { ok: true, skipped: 'no group jid' }
  }

  const dup = await adminDb
    .collection('relationships')
    .where('wa_group_id', '==', gid)
    .limit(1)
    .get()
  if (!dup.empty) {
    return { ok: true, skipped: 'already linked', relationship_id: dup.docs[0].id }
  }

  let matchId: string | null = null

  if (createKey) {
    const keySnap = await adminDb
      .collection('relationships')
      .where('wa_group_pending_create_key', '==', createKey)
      .limit(2)
      .get()
    if (keySnap.size === 1) matchId = keySnap.docs[0].id
    else if (keySnap.size > 1) {
      console.warn('[waha] group.v2.join: multiple relationships share wa_group_pending_create_key')
    }
  }

  // Subject correlation only for actual group creates — avoid linking on unrelated joins.
  if (!matchId && subject && joinType === 'new') {
    const subSnap = await adminDb
      .collection('relationships')
      .where('wa_group_pending_subject', '==', subject)
      .limit(25)
      .get()

    const pending = subSnap.docs.filter((d) => {
      const wa = d.data().wa_group_id as string | null | undefined
      return !wa
    })

    if (pending.length === 1) {
      matchId = pending[0].id
    } else if (pending.length > 1) {
      pending.sort((a, b) =>
        String(b.data().created_at ?? '').localeCompare(String(a.data().created_at ?? ''))
      )
      matchId = pending[0].id
      console.warn(
        `[waha] group.v2.join: ${pending.length} pending matches for subject "${subject}" — using newest relationship`
      )
    }
  }

  if (!matchId) {
    return { ok: true, skipped: 'no matching pending relationship' }
  }

  const reRef = adminDb.collection('relationships').doc(matchId)
  const reSnap = await reRef.get()
  if (!reSnap.exists) {
    return { ok: true, skipped: 'relationship missing' }
  }

  const reData = reSnap.data()!
  const now = new Date().toISOString()

  await reRef.update({
    wa_group_id: gid,
    wa_group_pending_subject: null,
    wa_group_pending_create_key: null,
    updated_at: now,
  })

  const companyLabel = (reData.company_name as string) || (reData.company_id as string) || 'Company'
  const mentorLabel = (reData.mentor_name as string) || (reData.mentor_id as string) || 'Mentor'

  await logActivity(adminDb, {
    type: 'WHATSAPP_GROUP_CREATED',
    entity_type: 'relationship',
    entity_id: matchId,
    entity_name: `${companyLabel} ↔ ${mentorLabel}`,
    detail: `WhatsApp group linked asynchronously (${gid})`,
  })

  console.log(`[waha] group.v2.join → linked ${gid} to relationship ${matchId}`)
  return { ok: true, relationship_id: matchId }
}

wahaRouter.post('/webhook', async (req, res) => {
  try {
    const body = req.body as WAHAPayload & Record<string, unknown>

    if (body.event === 'group.v2.join') {
      const result = await assignWaGroupFromGroupJoinEvent(body as Record<string, unknown>)
      return res.json(result)
    }

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
    // Group: match `wa_group_id`. DM: phone lookup on mentor/company profiles.
    let reId: string | null = null
    let senderSide: 'company' | 'mentor' | 'unknown' = 'unknown'
    let senderName = 'Unknown'

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
        console.warn(`[waha] No relationship found for group ${rawFrom} — skipping`)
      }
    } else {
      const phone = normalizePhone(rawFrom)
      if (phone) {
        const found = await findRelationshipByPhone(phone)
        if (found) {
          reId = found.reId
          senderSide = found.side
          senderName = found.entityName
          console.log(`[waha] ${phone} → ${senderSide} "${senderName}" → RE ${reId}`)
        } else {
          console.warn(`[waha] No relationship found for phone ${phone} — skipping`)
        }
      }
    }

    if (!reId) {
      return res.json({ ok: true, skipped: 'no matching relationship' })
    }

    // ── Sentiment analysis ────────────────────────────────────────────────
    const senderLabel =
      senderSide === 'company' ? 'company representative (mentee)'
      : senderSide === 'mentor' ? 'mentor'
      : 'participant'

    const sentimentPrompt =
      `Sender: ${senderLabel}\nMessage: "${messageText.replace(/"/g, "'").slice(0, 500)}"`

    const raw = await runAgent(wahaAgent, sentimentPrompt)
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

    console.log(`[waha] ${sentiment} | delta=${delta} | health=${newHealth.toFixed(2)} | relationship_id=${reId}`)
    return res.json({ ok: true, sentiment, health_score: newHealth, relationship_id: reId })
  } catch (err) {
    console.error('[waha] webhook error:', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
})

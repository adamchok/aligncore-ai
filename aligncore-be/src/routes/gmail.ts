import { Router } from 'express'
import { google } from 'googleapis'
import path from 'path'
import { readFileSync } from 'fs'
import { adminDb } from '../lib/firebase-admin'
import { runAgent } from '../lib/adk'
import { emailClassifierAgent } from '../lib/agents/emailClassifierAgent'
import { qnaAgent } from '../lib/agents/qnaAgent'
import { onboardingReplyAgent } from '../lib/agents/onboardingReplyAgent'
import { extractAgent } from '../lib/agents/extractAgent'
import { logActivity } from '../lib/activity'

export const gmailRouter = Router()

// ── Config ───────────────────────────────────────────────────────────────────

const WAHA_URL = process.env.WAHA_URL ?? 'http://localhost:3000'
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'default'
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''

function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

const userId = () => process.env.GMAIL_USER_EMAIL?.trim() || 'me'

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadQnA(): string {
  try {
    return readFileSync(path.join(process.cwd(), 'knowledge', 'qna.md'), 'utf8')
  } catch {
    return '(knowledge base not found)'
  }
}

function decodeBase64Url(data: string | null | undefined): string {
  if (!data) return ''
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function extractBodyText(payload: Record<string, unknown>): string {
  const mimeType = payload.mimeType as string | undefined
  const body = payload.body as { data?: string } | undefined
  const parts = payload.parts as Array<Record<string, unknown>> | undefined

  if (mimeType === 'text/plain' && body?.data) return decodeBase64Url(body.data)
  if (parts) {
    for (const part of parts) {
      const text = extractBodyText(part)
      if (text) return text
    }
  }
  return ''
}

function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

async function sendWhaMessage(phone: string, text: string): Promise<void> {
  if (!phone) return
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (WAHA_API_KEY) headers['X-Api-Key'] = WAHA_API_KEY
  try {
    await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ session: WAHA_SESSION, chatId: `${phone}@c.us`, text }),
    })
  } catch (e) {
    console.warn('[gmail] sendWhaMessage error:', e)
  }
}

async function sendGmailReply(
  gmail: ReturnType<typeof google.gmail>,
  to: string,
  subject: string,
  inReplyToMsgId: string,
  threadId: string,
  bodyText: string,
): Promise<void> {
  const cleanSubject = subject.replace(/^Re:\s*/i, '')
  const lines = [
    `To: ${to}`,
    `Subject: Re: ${cleanSubject}`,
    ...(inReplyToMsgId
      ? [`In-Reply-To: ${inReplyToMsgId}`, `References: ${inReplyToMsgId}`]
      : []),
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    bodyText,
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
  await gmail.users.messages.send({
    userId: userId(),
    requestBody: { raw, threadId },
  })
}

// ── Shared email processor ───────────────────────────────────────────────────

interface EmailLog {
  message_id: string
  thread_id: string
  from: string
  subject: string
  body_preview: string
  classification: string
  action: string
  reply_sent: boolean
  wa_notified: boolean
  company_id: string | null
  processed_at: string
  error: string | null
}

/**
 * Fetch a single Gmail message by ID, classify it, and act.
 * Returns null if already processed (duplicate guard).
 */
async function processGmailMessage(
  gmail: ReturnType<typeof google.gmail>,
  msgId: string,
): Promise<EmailLog | null> {
  // Dedup: skip if already logged
  const dup = await adminDb
    .collection('email_logs')
    .where('message_id', '==', msgId)
    .limit(1)
    .get()
  if (!dup.empty) return null

  const logEntry: EmailLog = {
    message_id: msgId,
    thread_id: '',
    from: '',
    subject: '',
    body_preview: '',
    classification: 'OTHER',
    action: 'skipped',
    reply_sent: false,
    wa_notified: false,
    company_id: null,
    processed_at: new Date().toISOString(),
    error: null,
  }

  try {
    const fullMsg = await gmail.users.messages.get({
      userId: userId(),
      id: msgId,
      format: 'full',
    })

    const payload = fullMsg.data.payload as Record<string, unknown> | undefined
    const headers = payload?.headers as Array<{ name: string; value: string }> | undefined

    logEntry.thread_id = fullMsg.data.threadId ?? ''
    logEntry.from = getHeader(headers, 'From')
    logEntry.subject = getHeader(headers, 'Subject')
    const messageId = getHeader(headers, 'Message-ID') || getHeader(headers, 'Message-Id')

    const body = payload ? extractBodyText(payload) : ''
    logEntry.body_preview = body.slice(0, 300)

    // ── Classify ──────────────────────────────────────────────────────────
    const classifyRaw = await runAgent(
      emailClassifierAgent,
      `From: ${logEntry.from}\nSubject: ${logEntry.subject}\n\n${body.slice(0, 2000)}`,
    )

    let classification = 'OTHER'
    try {
      const match = classifyRaw.replace(/```json?\n?/gi, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as { classification?: string }
        if (['ONBOARDING', 'QNA', 'OTHER'].includes(parsed.classification ?? '')) {
          classification = parsed.classification!
        }
      }
    } catch { /* default OTHER */ }

    logEntry.classification = classification
    const ownerPhone = (process.env.WHATSAPP_OWNER_PHONE ?? '').replace(/\D/g, '')

    if (classification === 'ONBOARDING') {
      const profileRaw = await runAgent(extractAgent, body.slice(0, 4000))
      let profile: Record<string, string> = {}
      try {
        const match = profileRaw.replace(/```json?\n?/gi, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
        if (match) profile = JSON.parse(match[0]) as Record<string, string>
      } catch { /* empty profile */ }

      const senderName = logEntry.from.replace(/<.*>/, '').trim() || logEntry.from.split('@')[0]
      const companyData = {
        name: profile.name?.trim() || senderName,
        industry: profile.industry || '',
        stage: profile.stage || '',
        about: profile.about || '',
        problem: profile.problem || '',
        goals: profile.goals || '',
        size: profile.size || '',
        created_at: new Date().toISOString(),
      }
      const compRef = await adminDb.collection('companies').add(companyData)
      logEntry.company_id = compRef.id

      const replyText = await runAgent(
        onboardingReplyAgent,
        `Original email:\nFrom: ${logEntry.from}\nSubject: ${logEntry.subject}\n\n${body.slice(0, 2000)}`,
      )
      await sendGmailReply(gmail, logEntry.from, logEntry.subject, messageId, logEntry.thread_id, replyText)

      logEntry.action = `onboarding — created company "${companyData.name}" and replied`
      logEntry.reply_sent = true

      await logActivity(adminDb, {
        type: 'AI_EXTRACT',
        entity_type: 'company',
        entity_id: compRef.id,
        entity_name: companyData.name,
        detail: `Gmail AI: onboarding email from ${logEntry.from} — profile created and reply sent`,
      })
    } else if (classification === 'QNA') {
      const qnaContent = loadQnA()
      const qnaPrompt =
        `=== KNOWLEDGE BASE ===\n${qnaContent}\n=== END KNOWLEDGE BASE ===\n\n` +
        `Email from: ${logEntry.from}\nSubject: ${logEntry.subject}\n\n${body.slice(0, 2000)}`
      const answer = await runAgent(qnaAgent, qnaPrompt)

      if (answer.trim().startsWith('CANNOT_ANSWER')) {
        if (ownerPhone) {
          await sendWhaMessage(
            ownerPhone,
            `*AlignCore AI* — Q&A email I cannot answer\n` +
              `*From:* ${logEntry.from}\n*Subject:* ${logEntry.subject}\n\n` +
              `*Question:*\n${body.slice(0, 600)}`,
          )
          logEntry.wa_notified = true
        }
        logEntry.action = 'QnA — cannot answer, owner notified via WhatsApp'
      } else {
        await sendGmailReply(gmail, logEntry.from, logEntry.subject, messageId, logEntry.thread_id, answer)
        logEntry.action = 'QnA — answered and replied'
        logEntry.reply_sent = true
      }
    } else {
      logEntry.action = 'OTHER — skipped'
    }

    // Mark as read
    await gmail.users.messages.modify({
      userId: userId(),
      id: msgId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  } catch (err) {
    logEntry.error = String(err)
    logEntry.action = 'error during processing'
    console.error(`[gmail] error processing message ${msgId}:`, err)
  }

  await adminDb.collection('email_logs').add(logEntry)
  return logEntry
}

// ── POST /api/gmail/watch ────────────────────────────────────────────────────
// Call once to register Gmail push notifications. Re-call every ≤7 days (watch expires).
// Stores the returned historyId in Firestore so the webhook knows where to start.

gmailRouter.post('/watch', async (_req, res) => {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    return res.status(503).json({ error: 'Gmail not configured' })
  }
  const topicName = process.env.GMAIL_PUBSUB_TOPIC
  if (!topicName) {
    return res.status(503).json({ error: 'GMAIL_PUBSUB_TOPIC not set — set to projects/{id}/topics/{name}' })
  }

  try {
    const gmail = getGmailClient()
    const watchRes = await gmail.users.watch({
      userId: userId(),
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      },
    })

    const historyId = watchRes.data.historyId ?? ''
    const expiration = watchRes.data.expiration ?? ''

    // Persist so the webhook handler knows the starting historyId
    await adminDb.collection('system_config').doc('gmail').set(
      { watch_history_id: historyId, watch_expiration: expiration, watch_topic: topicName },
      { merge: true },
    )

    console.log(`[gmail] watch registered — historyId=${historyId} expires=${expiration}`)
    return res.json({ ok: true, historyId, expiration })
  } catch (err) {
    console.error('[gmail] POST /watch:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/gmail/webhook ──────────────────────────────────────────────────
// Pub/Sub push endpoint. Google sends a POST when a new email arrives in INBOX.
// Always respond 200 OK — non-2xx causes Pub/Sub to retry.

gmailRouter.post('/webhook', async (req, res) => {
  // Acknowledge immediately so Pub/Sub doesn't retry on slow AI processing
  res.sendStatus(200)

  try {
    const body = req.body as {
      message?: { data?: string; messageId?: string }
      subscription?: string
    }

    if (!body.message?.data) {
      console.warn('[gmail] webhook: missing message.data')
      return
    }

    // Decode Pub/Sub envelope → { emailAddress, historyId }
    const decoded = decodeBase64Url(body.message.data)
    let notification: { emailAddress?: string; historyId?: string } = {}
    try {
      notification = JSON.parse(decoded)
    } catch {
      console.warn('[gmail] webhook: failed to parse notification:', decoded)
      return
    }

    const newHistoryId = notification.historyId
    if (!newHistoryId) return

    // Load last processed historyId from Firestore
    const configSnap = await adminDb.collection('system_config').doc('gmail').get()
    const lastHistoryId: string = configSnap.data()?.watch_history_id ?? newHistoryId

    // Update stored historyId before fetching (prevents reprocessing on retry)
    await adminDb.collection('system_config').doc('gmail').set(
      { watch_history_id: newHistoryId },
      { merge: true },
    )

    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
      console.warn('[gmail] webhook: Gmail not configured')
      return
    }

    const gmail = getGmailClient()

    // Fetch history since last known historyId to get new message IDs
    const historyRes = await gmail.users.history.list({
      userId: userId(),
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    const historyRecords = historyRes.data.history ?? []
    const messageIds = new Set<string>()

    for (const record of historyRecords) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id) messageIds.add(added.message.id)
      }
    }

    console.log(`[gmail] webhook: ${messageIds.size} new message(s) since historyId=${lastHistoryId}`)

    for (const msgId of messageIds) {
      const result = await processGmailMessage(gmail, msgId)
      if (result) {
        console.log(`[gmail] webhook: processed ${msgId} → ${result.classification} | ${result.action}`)
      }
    }
  } catch (err) {
    // Don't throw — response already sent
    console.error('[gmail] webhook processing error:', err)
  }
})

// ── POST /api/gmail/process ──────────────────────────────────────────────────
// Manual trigger — fetches unread emails and processes them. Useful as a fallback
// when the Pub/Sub webhook isn't set up yet or during development.

gmailRouter.post('/process', async (_req, res) => {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    return res.status(503).json({ error: 'Gmail not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN' })
  }

  try {
    const gmail = getGmailClient()

    const listRes = await gmail.users.messages.list({
      userId: userId(),
      q: 'is:unread -category:promotions -category:social',
      maxResults: 10,
    })

    const messages = listRes.data.messages ?? []
    if (!messages.length) return res.json({ processed: 0, results: [] })

    const results: EmailLog[] = []
    for (const msg of messages) {
      const result = await processGmailMessage(gmail, msg.id!)
      if (result) results.push(result)
    }

    return res.json({ processed: results.length, results })
  } catch (err) {
    console.error('[gmail] POST /process:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── GET /api/gmail/log ───────────────────────────────────────────────────────

gmailRouter.get('/log', async (_req, res) => {
  try {
    const snap = await adminDb
      .collection('email_logs')
      .orderBy('processed_at', 'desc')
      .limit(50)
      .get()
    return res.json({ logs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
})

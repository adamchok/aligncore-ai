import { randomUUID } from 'crypto'
import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { generateChat } from '../lib/ai'
import { logActivity } from '../lib/activity'
import { normalizePhone } from './waha'

export const chatRouter = Router()

const SYSTEM_PROMPT = `You are AlignCore AI's onboarding assistant. Collect a company profile through friendly chat — not a form.

Collect these 6 fields naturally, one at a time:
1. name — company name
2. industry — sector (e.g. FinTech, Deep Tech, HealthTech, SaaS)
3. stage — Idea / Pre-seed / Seed / Series A / Growth
4. problem — main challenge or problem they're solving
5. goals — what they want from mentorship
6. whatsapp — founder's WhatsApp number (for check-ins)

Rules:
- Be warm and concise. Ask one question at a time.
- If the user volunteers several fields, acknowledge all and continue.
- Only when all 6 are confirmed, output this exact tagged block once (no prose inside the tags):
  <PROFILE>{"name":"...","industry":"...","stage":"...","problem":"...","goals":"...","whatsapp":"..."}</PROFILE>
- After the closing tag in the same reply, thank them briefly and mention they can use Match to find top mentors.

Before completion: conversational text only; never output PROFILE or partial JSON outside the tags.`

type ChatRole = 'user' | 'model'

interface IncomingChatMessage {
  role: ChatRole
  parts?: Array<{ text: string }>
  /** API contract shape from MVP guide */
  text?: string
}

function toGeminiParts(m: IncomingChatMessage): Array<{ text: string }> {
  if (m.parts?.length) return m.parts
  if (typeof m.text === 'string' && m.text.length > 0) return [{ text: m.text }]
  return []
}

chatRouter.post('/', async (req, res) => {
  try {
    const { messages, sessionId: bodySessionId, session_id } = req.body as {
      messages: IncomingChatMessage[]
      sessionId?: string
      session_id?: string
    }

    // Accept camelCase (FE) or snake_case (legacy); generate a new ID if absent
    const sessionId = bodySessionId || session_id || randomUUID()

    if (!messages?.length) {
      return res.status(400).json({ error: 'messages (non-empty) is required' })
    }

    for (let i = 0; i < messages.length; i++) {
      if (toGeminiParts(messages[i]).length === 0) {
        return res
          .status(400)
          .json({ error: `messages[${i}] must include text or parts with non-empty text` })
      }
    }

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> =
      messages.map((m) => ({
        role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
        parts: toGeminiParts(m),
      }))

    const replyRaw = await generateChat(contents, SYSTEM_PROMPT)

    const profileMatch = replyRaw.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
    let profileExtracted: Record<string, string> | null = null
    let isComplete = false

    let autoCompanyId: string | null = null

    if (profileMatch) {
      try {
        profileExtracted = JSON.parse(profileMatch[1].trim()) as Record<string, string>
        isComplete = true

        await adminDb.collection('onboarding_sessions').doc(sessionId).set({
          ...profileExtracted,
          session_id: sessionId,
          completed_at: new Date().toISOString(),
        })

        await logActivity(adminDb, {
          type: 'ONBOARDING_COMPLETE',
          entity_type: 'onboarding',
          entity_id: sessionId,
          entity_name: profileExtracted.name || 'Unknown',
          detail: `Onboarding complete for "${profileExtracted.name || 'company'}" via AI chat`,
        })

        // Auto-create company entity from completed profile
        const { name, industry, stage, problem, goals, whatsapp } = profileExtracted
        if (name?.trim() && industry?.trim() && stage?.trim()) {
          try {
            const companyDoc = {
              name: name.trim(),
              industry: industry.trim(),
              stage: stage.trim(),
              problem: problem?.trim() ?? '',
              goals: goals?.trim() ?? '',
              size: '',
              whatsapp_number: normalizePhone(whatsapp ?? ''),
              created_at: new Date().toISOString(),
            }
            const companyRef = await adminDb.collection('companies').add(companyDoc)
            autoCompanyId = companyRef.id
            await logActivity(adminDb, {
              type: 'COMPANY_CREATED',
              entity_type: 'company',
              entity_id: companyRef.id,
              entity_name: name.trim(),
              detail: `Company "${name.trim()}" auto-created from onboarding chat`,
            })
          } catch (companyErr) {
            console.warn('[chat] Auto-create company failed:', companyErr)
          }
        }

        console.log(`[chat] Onboarding complete for session ${sessionId}`)
      } catch {
        console.warn('[chat] Failed to parse PROFILE JSON')
      }
    }

    const reply = replyRaw.replace(/<PROFILE>[\s\S]*?<\/PROFILE>\s*/, '').trim()

    return res.json({
      reply,
      sessionId,
      profile_extracted: profileExtracted,
      is_complete: isComplete,
      company_id: autoCompanyId,
    })
  } catch (err) {
    console.error('[chat] error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

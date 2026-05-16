import { randomUUID } from 'crypto'
import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { runAgent } from '../lib/adk'
import { onboardingAgent } from '../lib/agents/onboardingAgent'
import { logActivity } from '../lib/activity'
import { normalizePhone } from './waha'

export const chatRouter = Router()

type ChatRole = 'user' | 'model'

interface IncomingChatMessage {
  role: ChatRole
  parts?: Array<{ text: string }>
  text?: string
}

function toText(m: IncomingChatMessage): string {
  if (m.parts?.length) return m.parts.map(p => p.text).join('')
  if (typeof m.text === 'string' && m.text.length > 0) return m.text
  return ''
}

chatRouter.post('/', async (req, res) => {
  try {
    const { messages, sessionId: bodySessionId, session_id } = req.body as {
      messages: IncomingChatMessage[]
      sessionId?: string
      session_id?: string
    }

    const sessionId = bodySessionId || session_id || randomUUID()

    if (!messages?.length) {
      return res.status(400).json({ error: 'messages (non-empty) is required' })
    }

    for (let i = 0; i < messages.length; i++) {
      if (!toText(messages[i])) {
        return res.status(400).json({
          error: `messages[${i}] must include text or parts with non-empty text`,
        })
      }
    }

    // Build a linearized history so the agent has full conversation context in one turn.
    // This keeps the route stateless (the FE sends the full history each request).
    const history = messages.slice(0, -1)
      .map(m => `${m.role === 'model' ? 'Assistant' : 'User'}: ${toText(m)}`)
      .join('\n')
    const lastUserText = toText(messages[messages.length - 1])
    const prompt = history
      ? `Conversation so far:\n${history}\n\n---\nUser: ${lastUserText}`
      : lastUserText

    const replyRaw = await runAgent(onboardingAgent, prompt)

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

        const { name, industry, stage, about, problem, goals, whatsapp } = profileExtracted
        if (name?.trim() && industry?.trim() && stage?.trim()) {
          try {
            const companyDoc = {
              name: name.trim(),
              industry: industry.trim(),
              stage: stage.trim(),
              about: about?.trim() ?? '',
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

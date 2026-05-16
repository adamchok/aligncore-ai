import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { genai, MODELS } from '../lib/gemini'

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
    const { messages, session_id } = req.body as {
      messages: IncomingChatMessage[]
      session_id: string
    }

    if (!messages?.length || !session_id) {
      return res.status(400).json({ error: 'messages (non-empty) and session_id are required' })
    }

    for (let i = 0; i < messages.length; i++) {
      if (toGeminiParts(messages[i]).length === 0) {
        return res
          .status(400)
          .json({ error: `messages[${i}] must include text or parts with non-empty text` })
      }
    }

    const contents = messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: toGeminiParts(m),
    }))

    const result = await genai.models.generateContent({
      model: MODELS.flash,
      contents,
      config: {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      },
    })

    const replyRaw = result.text ?? ''

    const profileMatch = replyRaw.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
    let profileExtracted: Record<string, string> | null = null
    let isComplete = false

    if (profileMatch) {
      try {
        profileExtracted = JSON.parse(profileMatch[1].trim()) as Record<string, string>
        isComplete = true

        await adminDb.collection('onboarding_sessions').doc(session_id).set({
          ...profileExtracted,
          session_id,
          completed_at: new Date().toISOString(),
        })

        console.log(`[chat] Onboarding complete for session ${session_id}`)
      } catch {
        console.warn('[chat] Failed to parse PROFILE JSON')
      }
    }

    const reply = replyRaw.replace(/<PROFILE>[\s\S]*?<\/PROFILE>\s*/, '').trim()

    return res.json({
      reply,
      profile_extracted: profileExtracted,
      is_complete: isComplete,
    })
  } catch (err) {
    console.error('[chat] error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

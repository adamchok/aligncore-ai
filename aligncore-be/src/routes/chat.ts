import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { genai, MODELS } from '../lib/gemini'

export const chatRouter = Router()

const SYSTEM_PROMPT = `You are AlignCore AI's friendly onboarding assistant.
Your goal is to collect the following 6 fields from the user in a natural conversation:
1. company_name — the company's name
2. industry — e.g. FinTech, HealthTech, EdTech, SaaS, Manufacturing, etc.
3. company_stage — Idea / Pre-seed / Seed / Series A / Growth
4. company_size — number of employees (Small 1-50, Medium 51-500, Large 500+)
5. main_challenge — the biggest challenge they are facing right now
6. desired_mentor_expertise — what kind of mentor expertise would help most

Rules:
- Ask one question at a time. Keep responses concise and warm.
- If the user provides multiple fields at once, acknowledge all and move on.
- When all 6 fields are collected, output a structured profile in this exact format on a new line:
  <PROFILE>{"company_name":"...","industry":"...","company_stage":"...","company_size":"...","main_challenge":"...","desired_mentor_expertise":"..."}</PROFILE>
- Then thank the user and tell them you are finding the best mentors for them.
- Do NOT output the PROFILE tag until you have confirmed all 6 fields.`

interface ChatMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

chatRouter.post('/', async (req, res) => {
  try {
    const { messages, session_id } = req.body as {
      messages: ChatMessage[]
      session_id: string
    }

    if (!messages || !session_id) {
      return res.status(400).json({ error: 'messages and session_id are required' })
    }

    // ── Call Gemini with full history ────────────────────────────────────
    const result = await genai.models.generateContent({
      model: MODELS.flash,
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: "Hi! I'm AlignCore AI. Let's get started — what's your company name?" }] },
        ...messages,
      ],
    })

    const reply = result.text ?? ''

    // ── Detect completed profile ─────────────────────────────────────────
    const profileMatch = reply.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
    let profileExtracted: Record<string, string> | null = null
    let isComplete = false

    if (profileMatch) {
      try {
        profileExtracted = JSON.parse(profileMatch[1]) as Record<string, string>
        isComplete = true

        // Persist to Firestore
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

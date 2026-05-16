import Anthropic from '@anthropic-ai/sdk'
import { genai, MODELS } from './gemini'

// ── Provider selection ────────────────────────────────────────────────────────
// Set AI_PROVIDER=anthropic + ANTHROPIC_API_KEY in .env to use Claude.
// Defaults to Gemini (requires GEMINI_API_KEY or Vertex AI credentials).
// embedText() is always Gemini — Anthropic has no embedding API.

const provider = (process.env.AI_PROVIDER ?? 'gemini') as 'gemini' | 'anthropic'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() ?? 'claude-haiku-4-5-20251001'

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
    if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY when AI_PROVIDER=anthropic')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

// ── generateText ──────────────────────────────────────────────────────────────

/** Single-turn text generation — routes to Gemini or Anthropic based on AI_PROVIDER. */
export async function generateText(prompt: string): Promise<string> {
  if (provider === 'anthropic') {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = res.content[0]
    return block.type === 'text' ? block.text : ''
  }

  const result = await genai.models.generateContent({
    model: MODELS.flash,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  return result.text ?? ''
}

// ── generateChat ──────────────────────────────────────────────────────────────

/** Multi-turn chat with a system prompt. Messages use Gemini role/parts shape;
 *  the wrapper normalises to Anthropic's format when AI_PROVIDER=anthropic. */
export async function generateChat(
  messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  systemPrompt: string,
): Promise<string> {
  if (provider === 'anthropic') {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: (m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.parts.map((p) => p.text).join(''),
      })),
    })
    const block = res.content[0]
    return block.type === 'text' ? block.text : ''
  }

  const result = await genai.models.generateContent({
    model: MODELS.flash,
    contents: messages,
    config: { systemInstruction: { parts: [{ text: systemPrompt }] } },
  })
  return result.text ?? ''
}

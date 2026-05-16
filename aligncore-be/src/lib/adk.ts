import { InMemoryRunner, isFinalResponse } from '@google/adk'
import { createUserContent } from '@google/genai'
import type { BaseAgent } from '@google/adk'

// Map GEMINI_API_KEY → GOOGLE_API_KEY (ADK reads this env var)
if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY.trim()
}

// Enable Vertex AI mode if configured
if (process.env.GEMINI_USE_VERTEX === 'true' || process.env.GEMINI_USE_VERTEX === '1') {
  process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true'
  if (!process.env.GOOGLE_CLOUD_PROJECT && process.env.FIREBASE_PROJECT_ID) {
    process.env.GOOGLE_CLOUD_PROJECT = process.env.FIREBASE_PROJECT_ID.trim()
  }
}

export const AI_MODEL = process.env.AI_MODEL?.trim() || 'gemini-2.5-flash'

type AdkEvent = {
  content?: { parts?: Array<{ text?: string }> }
}

function extractText(event: AdkEvent): string {
  return (event.content?.parts ?? []).map(p => p.text ?? '').join('')
}

/**
 * Run an agent for a single turn using an ephemeral session (auto-created and discarded).
 * Use for all stateless agents: match, extract, summary, waha sentiment.
 */
export async function runAgent(agent: BaseAgent, userMessage: string): Promise<string> {
  const runner = new InMemoryRunner({ appName: 'aligncore', agent })
  let result = ''
  for await (const event of runner.runEphemeral({
    userId: 'system',
    newMessage: createUserContent(userMessage),
  })) {
    const e = event as AdkEvent & { errorCode?: number; errorMessage?: string }
    if (e.errorCode || e.errorMessage) {
      throw new Error(`Gemini API error ${e.errorCode ?? ''}: ${e.errorMessage ?? 'unknown'}`)
    }
    if (isFinalResponse(event as unknown as Parameters<typeof isFinalResponse>[0])) {
      result = extractText(event as AdkEvent)
    }
  }
  if (!result) {
    throw new Error('No response from AI model — check your API key quota or rate limits')
  }
  return result
}

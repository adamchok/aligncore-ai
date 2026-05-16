import { GoogleGenAI } from '@google/genai'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment')
}

export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export const MODELS = {
  flash: 'gemini-2.0-flash',
  embedding: 'text-embedding-004',
} as const

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a text completion from Gemini Flash */
export async function generateText(prompt: string): Promise<string> {
  const result = await genai.models.generateContent({
    model: MODELS.flash,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  return result.text ?? ''
}

/** Embed a string using text-embedding-004 */
export async function embedText(text: string): Promise<number[]> {
  const result = await genai.models.embedContent({
    model: MODELS.embedding,
    contents: [{ role: 'user', parts: [{ text }] }],
  })
  return result.embeddings?.[0]?.values ?? []
}

/** Cosine similarity between two equal-length vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] ** 2
    magB += b[i] ** 2
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

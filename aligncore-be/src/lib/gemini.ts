import { GoogleGenAI } from '@google/genai'

const useVertex =
  process.env.GEMINI_USE_VERTEX === 'true' || process.env.GEMINI_USE_VERTEX === '1'

function createGenAI(): GoogleGenAI {
  if (useVertex) {
    const project =
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      process.env.GCLOUD_PROJECT?.trim() ||
      process.env.FIREBASE_PROJECT_ID?.trim()
    const location =
      process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
      process.env.VERTEX_AI_LOCATION?.trim()
    if (!project || !location) {
      throw new Error(
        'Vertex AI enabled (GEMINI_USE_VERTEX=true): set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION (e.g. us-central1). Ensure GOOGLE_APPLICATION_CREDENTIALS points to a service account with Vertex AI User on that project.'
      )
    }
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Set GEMINI_API_KEY for Gemini Developer API, or GEMINI_USE_VERTEX=true with GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION + GOOGLE_APPLICATION_CREDENTIALS'
    )
  }
  return new GoogleGenAI({ apiKey })
}

export const genai = createGenAI()

/** Vertex & Developer APIs accept these IDs via @google/genai */
export const MODELS = {
  flash: 'gemini-2.5-flash',
  embedding: 'gemini-embedding-001',
} as const

/** Task types for gemini-embedding-001 — use RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT for matching. */
export type EmbeddingTaskType =
  | 'SEMANTIC_SIMILARITY'
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a text completion from Gemini Flash */
export async function generateText(prompt: string): Promise<string> {
  const result = await genai.models.generateContent({
    model: MODELS.flash,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  return result.text ?? ''
}

/** Embed text with gemini-embedding-001 (asymmetric retrieval: query vs document). */
export async function embedText(
  text: string,
  taskType: EmbeddingTaskType = 'SEMANTIC_SIMILARITY'
): Promise<number[]> {
  if (!useVertex) {
    // Use REST API directly — avoids @google/genai picking up GOOGLE_APPLICATION_CREDENTIALS
    // (ADC service-account tokens are rejected by generativelanguage.googleapis.com)
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.embedding}:embedContent?key=${encodeURIComponent(apiKey)}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${MODELS.embedding}`,
        content: { parts: [{ text }] },
        taskType,
      }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`Gemini embed API ${resp.status}: ${errText}`)
    }
    const data = (await resp.json()) as { embedding?: { values?: number[] } }
    return data.embedding?.values ?? []
  }

  const result = await genai.models.embedContent({
    model: MODELS.embedding,
    contents: [{ role: 'user', parts: [{ text }] }],
    config: { taskType },
  })
  return result.embeddings?.[0]?.values ?? []
}

/** Cosine similarity between two equal-length vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0,
    magA = 0,
    magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] ** 2
    magB += b[i] ** 2
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

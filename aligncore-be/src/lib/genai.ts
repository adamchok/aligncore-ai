import { GoogleGenAI } from '@google/genai'

// Shared Gemini client for direct API calls (PDF multimodal, knowledge extraction).
// ADK handles its own auth separately via GOOGLE_API_KEY / GOOGLE_GENAI_USE_VERTEXAI.

function createGenAI(): GoogleGenAI {
  const useVertex = process.env.GEMINI_USE_VERTEX === 'true' || process.env.GEMINI_USE_VERTEX === '1'
  if (useVertex) {
    const project =
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      process.env.GCLOUD_PROJECT?.trim() ||
      process.env.FIREBASE_PROJECT_ID?.trim()
    const location =
      process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
      process.env.VERTEX_AI_LOCATION?.trim() ||
      'us-central1'
    if (!project) {
      throw new Error(
        'Vertex AI enabled (GEMINI_USE_VERTEX=true): set GOOGLE_CLOUD_PROJECT. ' +
        'Ensure GOOGLE_APPLICATION_CREDENTIALS points to a service account with Vertex AI User role.'
      )
    }
    return new GoogleGenAI({ vertexai: true, project, location })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Set GEMINI_API_KEY for the Gemini Developer API, or use GEMINI_USE_VERTEX=true with ' +
      'GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION + GOOGLE_APPLICATION_CREDENTIALS.'
    )
  }
  return new GoogleGenAI({ apiKey })
}

export const genai = createGenAI()
export const GEMINI_MODEL = 'gemini-2.5-flash'

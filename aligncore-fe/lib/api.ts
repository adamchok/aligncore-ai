import type { Mentor, Company, LifecycleState, CompanyCSVRow, RelationshipEntity } from './types'

const BE = process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:4000'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Match ────────────────────────────────────────────────────────────────────

export interface CompanyProfile {
  name: string
  industry?: string
  stage?: string
  /** What the company does / builds */
  about?: string
  problem?: string
  goals?: string
  mentor_expertise?: string
  size?: string
}

export interface MatchResult {
  id: string
  name: string
  industry: string
  expertise: string[]
  bio: string
  ai_match_score: number
  reasoning: string
  rank: number
}

export const matchMentors = (profile: CompanyProfile) =>
  req<{ matches: MatchResult[] }>('POST', '/api/match', { company_profile: profile })

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface ChatResponse {
  reply: string
  sessionId: string
  profile_extracted: Record<string, string> | null
  is_complete: boolean
  company_id: string | null
}

export const sendChat = (messages: ChatMessage[], sessionId?: string) =>
  req<ChatResponse>('POST', '/api/chat', { messages, sessionId })

// ── Entities — Mentors ───────────────────────────────────────────────────────

export const createMentor = (data: Omit<Mentor, 'id' | 'created_at'>) =>
  req<{ id: string; mentor: Mentor }>('POST', '/api/entities/mentors', data)

export const updateMentor = (id: string, data: Partial<Omit<Mentor, 'id' | 'created_at'>>) =>
  req<{ id: string; mentor: Mentor }>('PATCH', `/api/entities/mentors/${id}`, data)

/** Multipart upload to GCS via backend. Updates mentor.photo_url (requires KNOWLEDGE_BUCKET). */
export async function uploadMentorProfilePhoto(mentorId: string, file: File): Promise<Mentor> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BE}/api/entities/mentors/${mentorId}/photo`, { method: 'POST', body: form })
  const text = await res.text()
  if (!res.ok) {
    let msg = text || `Upload failed (${res.status})`
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* keep msg */
    }
    throw new Error(msg)
  }
  const data = JSON.parse(text) as { mentor: Mentor }
  return data.mentor
}

// ── Entities — Companies ─────────────────────────────────────────────────────

export const createCompany = (data: Omit<Company, 'id' | 'created_at'>) =>
  req<{ id: string; company: Company }>('POST', '/api/entities/companies', data)

export const updateCompany = (id: string, data: Partial<Omit<Company, 'id' | 'created_at'>>) =>
  req<{ id: string; company: Company }>('PATCH', `/api/entities/companies/${id}`, data)

export const deleteCompany = (id: string) => req<{ ok: boolean }>('DELETE', `/api/entities/companies/${id}`)

export async function uploadCompanyProfilePhoto(companyId: string, file: File): Promise<Company> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BE}/api/entities/companies/${companyId}/photo`, { method: 'POST', body: form })
  const text = await res.text()
  if (!res.ok) {
    let msg = text || `Upload failed (${res.status})`
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* keep msg */
    }
    throw new Error(msg)
  }
  const data = JSON.parse(text) as { company: Company }
  return data.company
}

// ── Entities — Relationships ─────────────────────────────────────────────────

export interface CreateRelationshipPayload {
  mentor_id: string
  company_id: string
  mentor_name?: string
  company_name?: string
  match_score?: number
  match_reasoning?: string
}

export const createRelationship = (data: CreateRelationshipPayload) =>
  req<{ id: string }>('POST', '/api/entities/relationships', data)

export const getRelationship = (id: string) =>
  req<{ id: string; relationship: RelationshipEntity }>('GET', `/api/entities/relationships/${id}`)

export const updateRelationshipLifecycle = (id: string, lifecycle: LifecycleState) =>
  req<{ id: string; relationship: RelationshipEntity }>('PATCH', `/api/entities/relationships/${id}`, { lifecycle })

export interface RelationshipPatch {
  mentor_id?: string
  company_id?: string
  lifecycle?: LifecycleState
  notes?: string | null
  wa_group_id?: string | null
  mentor_phone?: string
  company_phone?: string
  match_score?: number | null
  match_reasoning?: string | null
  engagement?: Partial<{
    health_score: number
  }>
  comms?: Partial<{
    last_sentiment: string | null
    last_message_text: string | null
    last_message_preview: string | null
    last_wa_at: string | null
  }>
  ai_summary?: string | null
}

export const patchRelationship = (id: string, data: RelationshipPatch) =>
  req<{ id: string; relationship: RelationshipEntity }>('PATCH', `/api/entities/relationships/${id}`, data)

export const deleteRelationship = (id: string) =>
  req<{ ok: boolean }>('DELETE', `/api/entities/relationships/${id}`)

// ── AI ───────────────────────────────────────────────────────────────────────

export const generateSummary = (reId: string) =>
  req<{ summary: string }>('POST', `/api/ai/summary/${reId}`)

export interface ExtractedProfile {
  name: string
  industry: string
  stage: string
  about: string
  problem: string
  goals: string
  size: string
}

export const extractProfile = (text: string) =>
  req<{ profile: ExtractedProfile }>('POST', '/api/ai/extract', { text })

export async function extractProfileFromDoc(file: File): Promise<{ profile: ExtractedProfile; source_file: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BE}/api/ai/extract-doc`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API extract-doc → ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ profile: ExtractedProfile; source_file: string }>
}

export interface ExtractedMentorProfile {
  name: string
  bio: string
  industry: string
  expertise: string[]
}

export async function extractMentorFromDoc(files: File[]): Promise<{ profile: ExtractedMentorProfile; source_files: string[] }> {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  const res = await fetch(`${BE}/api/ai/extract-mentor-doc`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(JSON.parse(text)?.error ?? `Extract failed (${res.status})`)
  }
  return res.json() as Promise<{ profile: ExtractedMentorProfile; source_files: string[] }>
}

export const batchImportCompanies = (rows: CompanyCSVRow[]) =>
  req<{ created: number; ids: string[]; errors: string[] }>('POST', '/api/entities/companies/batch', { rows })

/** Upload one document to company or mentor knowledge base (multipart). */
export async function uploadKnowledgeDocument(
  entityType: 'company' | 'mentor',
  entityId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BE}/api/knowledge/${entityType}/${entityId}/upload`, { method: 'POST', body: form })
  const text = await res.text()
  if (!res.ok) {
    let msg = text || `Upload failed (${res.status})`
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* keep msg */
    }
    return { ok: false, error: `${file.name}: ${msg}` }
  }
  return { ok: true }
}

// ── WAHA ─────────────────────────────────────────────────────────────────────

/** WAHA may return `engine` as a string or a structured object (e.g. `{ grpc, gows }`). */
export interface WAHASession {
  name: string
  status: string
  engine?: string | Record<string, unknown>
}

/**
 * Stable tokens for the WhatsApp settings UI.
 * FE calls `GET /api/waha/session` → AlignCore BE proxies `GET {WAHA_URL}/api/sessions/{WAHA_SESSION}` (WAHA JSON as-is).
 * WAHA commonly uses **`WORKING`** for a linked session; we map that to **`CONNECTED`** for the dashboard.
 */
export type WahaUiStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'SCAN_QR_CODE'
  | 'STARTING'
  | 'STOPPED'
  | 'FAILED'
  | 'UNKNOWN'

export function normalizeWahaUiStatus(raw: string | undefined): WahaUiStatus {
  if (!raw?.trim()) return 'UNKNOWN'
  const s = raw.trim().toUpperCase()
  if (s === 'WORKING') return 'CONNECTED'
  switch (s) {
    case 'CONNECTED':
    case 'DISCONNECTED':
    case 'SCAN_QR_CODE':
    case 'STARTING':
    case 'STOPPED':
    case 'FAILED':
      return s
    default:
      return 'UNKNOWN'
  }
}

/** Safe label for UI — never returns a plain object (React cannot render objects as children). */
export function formatWahaEngine(engine: WAHASession['engine']): string | null {
  if (engine == null) return null
  if (typeof engine === 'string') return engine.trim() || null
  if (typeof engine === 'object') {
    const keys = Object.keys(engine).filter((k) => engine[k] != null)
    if (keys.length === 0) return null
    return keys.map((k) => k.toUpperCase()).join(' · ')
  }
  return null
}

/** WAHA `GET .../sessions/:name/me` — linked device `id` is typically `digits@c.us`. */
export interface WAHASessionMe {
  id?: string
  pushName?: string
}

/** Phone label for UI, or null if unavailable / request failed. */
export function formatWahaLinkedPhone(me: WAHASessionMe | null): string | null {
  if (!me?.id) return null
  const local = me.id.split('@')[0] ?? ''
  if (/^\d{6,}$/.test(local)) return `+${local}`
  return me.id
}

export const wahaGetSession = () =>
  req<WAHASession>('GET', '/api/waha/session')

/** Does not throw when WAHA session is not linked yet — returns null on non-OK response. */
export async function wahaGetSessionMe(): Promise<WAHASessionMe | null> {
  const res = await fetch(`${BE}/api/waha/session/me`, { method: 'GET' })
  if (!res.ok) return null
  return res.json() as Promise<WAHASessionMe>
}

export const wahaGetQR = () =>
  req<{ qr: string | null; status: string }>('GET', '/api/waha/qr')

export const wahaStartSession = () =>
  req<{ ok: boolean }>('POST', '/api/waha/session/start')

export const wahaRestartSession = () =>
  req<{ ok: boolean }>('POST', '/api/waha/session/restart')

/** Linked-session WhatsApp groups (`…@g.us`). Response is always 200; check `error` if `groups` is empty unexpectedly. */
export interface WahaGroupChat {
  id: string
  name: string
}

export const wahaListGroupChats = () =>
  req<{ groups: WahaGroupChat[]; error?: string }>('GET', '/api/waha/group-chats')

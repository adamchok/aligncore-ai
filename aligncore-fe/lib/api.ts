import type { Mentor, Company, LifecycleState } from './types'

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

export const sendChat = (messages: ChatMessage[], sessionId?: string) =>
  req<{ reply: string; sessionId: string }>('POST', '/api/chat', { messages, sessionId })

// ── Demo ─────────────────────────────────────────────────────────────────────

export const demoPositive = () => req<{ ok: boolean }>('GET', '/api/demo/simulate-positive')
export const demoNegative = () => req<{ ok: boolean }>('GET', '/api/demo/simulate-negative')
export const demoReset = () => req<{ ok: boolean }>('GET', '/api/demo/reset')

// ── Entities — Mentors ───────────────────────────────────────────────────────

export const createMentor = (data: Omit<Mentor, 'id' | 'created_at'>) =>
  req<{ id: string; mentor: Mentor }>('POST', '/api/entities/mentors', data)

export const updateMentor = (id: string, data: Partial<Omit<Mentor, 'id'>>) =>
  req<{ id: string }>('PATCH', `/api/entities/mentors/${id}`, data)

// ── Entities — Companies ─────────────────────────────────────────────────────

export const createCompany = (data: Omit<Company, 'id' | 'created_at'>) =>
  req<{ id: string; company: Company }>('POST', '/api/entities/companies', data)

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

export const updateRelationshipLifecycle = (id: string, lifecycle: LifecycleState) =>
  req<{ id: string }>('PATCH', `/api/entities/relationships/${id}`, { lifecycle })

// ── AI ───────────────────────────────────────────────────────────────────────

export const generateSummary = (reId: string) =>
  req<{ summary: string }>('POST', `/api/ai/summary/${reId}`)

// ── WAHA ─────────────────────────────────────────────────────────────────────

export interface WAHASession {
  name: string
  status: string
  engine?: string
}

export const wahaGetSession = () =>
  req<WAHASession>('GET', '/api/waha/session')

export const wahaGetQR = () =>
  req<{ qr: string | null; status: string }>('GET', '/api/waha/qr')

export const wahaStartSession = () =>
  req<{ ok: boolean }>('POST', '/api/waha/session/start')

export const wahaRestartSession = () =>
  req<{ ok: boolean }>('POST', '/api/waha/session/restart')

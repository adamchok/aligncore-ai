import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'

export const entitiesRouter = Router()

// ── Mentors ──────────────────────────────────────────────────────────────────

entitiesRouter.post('/mentors', async (req, res) => {
  try {
    const { name, bio, expertise, industry, industries, available } = req.body as {
      name: string
      bio: string
      expertise?: string[]
      industry?: string
      industries?: string[]
      available?: boolean
    }

    if (!name?.trim() || !bio?.trim()) {
      return res.status(400).json({ error: 'name and bio are required' })
    }

    const doc = {
      name: name.trim(),
      bio: bio.trim(),
      expertise: expertise ?? [],
      industry: industry?.trim() ?? '',
      industries: industries ?? [],
      available: available ?? true,
      created_at: new Date().toISOString(),
    }

    const ref = await adminDb.collection('mentors').add(doc)
    return res.status(201).json({ id: ref.id, mentor: { id: ref.id, ...doc } })
  } catch (err) {
    console.error('[entities] POST /mentors:', err)
    return res.status(500).json({ error: String(err) })
  }
})

entitiesRouter.patch('/mentors/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['name', 'bio', 'expertise', 'industry', 'industries', 'available']
    const updates: Record<string, unknown> = {}

    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    await adminDb.collection('mentors').doc(id).update(updates)
    return res.json({ id })
  } catch (err) {
    console.error('[entities] PATCH /mentors/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── Companies ────────────────────────────────────────────────────────────────

entitiesRouter.post('/companies', async (req, res) => {
  try {
    const { name, industry, stage, problem, goals, size } = req.body as {
      name: string
      industry: string
      stage: string
      problem?: string
      goals?: string
      size?: string
    }

    if (!name?.trim() || !industry?.trim() || !stage?.trim()) {
      return res.status(400).json({ error: 'name, industry, and stage are required' })
    }

    const doc = {
      name: name.trim(),
      industry: industry.trim(),
      stage: stage.trim(),
      problem: problem?.trim() ?? '',
      goals: goals?.trim() ?? '',
      size: size?.trim() ?? '',
      created_at: new Date().toISOString(),
    }

    const ref = await adminDb.collection('companies').add(doc)
    return res.status(201).json({ id: ref.id, company: { id: ref.id, ...doc } })
  } catch (err) {
    console.error('[entities] POST /companies:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── Relationships ─────────────────────────────────────────────────────────────

entitiesRouter.post('/relationships', async (req, res) => {
  try {
    const { mentor_id, company_id, mentor_name, company_name, match_score, match_reasoning } =
      req.body as {
        mentor_id: string
        company_id: string
        mentor_name?: string
        company_name?: string
        match_score?: number
        match_reasoning?: string
      }

    if (!mentor_id?.trim() || !company_id?.trim()) {
      return res.status(400).json({ error: 'mentor_id and company_id are required' })
    }

    const now = new Date().toISOString()
    const doc = {
      mentor_id: mentor_id.trim(),
      company_id: company_id.trim(),
      mentor_name: mentor_name?.trim() ?? '',
      company_name: company_name?.trim() ?? '',
      lifecycle: 'ACTIVE',
      engagement: {
        health_score: 0.72,
        sessions_completed: 0,
        next_session: null,
      },
      comms: {
        last_sentiment: null,
        last_message_text: null,
        last_message_preview: null,
        last_wa_at: null,
      },
      ai_summary: null,
      ai_summary_updated_at: null,
      match_score: match_score ?? null,
      match_reasoning: match_reasoning ?? null,
      created_at: now,
      updated_at: now,
    }

    const ref = await adminDb.collection('relationships').add(doc)

    // Seed initial health history point
    await ref.collection('history').add({
      score: 0.72,
      sentiment: 'NEUTRAL',
      timestamp: now,
    })

    return res.status(201).json({ id: ref.id })
  } catch (err) {
    console.error('[entities] POST /relationships:', err)
    return res.status(500).json({ error: String(err) })
  }
})

entitiesRouter.patch('/relationships/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['lifecycle', 'engagement', 'comms', 'ai_summary']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }

    await adminDb.collection('relationships').doc(id).update(updates)
    return res.json({ id })
  } catch (err) {
    console.error('[entities] PATCH /relationships/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

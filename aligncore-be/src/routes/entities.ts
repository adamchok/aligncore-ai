import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { embedText } from '../lib/gemini'
import { logActivity } from '../lib/activity'
import { normalizePhone, createWAGroup } from './waha'

function mentorEmbedInput(m: {
  name: string; bio: string; expertise: string[]; industries: string[]; industry: string
}): string {
  return [m.name, m.bio, ...m.expertise, ...m.industries, m.industry].filter(Boolean).join('. ')
}

export const entitiesRouter = Router()

// ── Mentors ──────────────────────────────────────────────────────────────────

entitiesRouter.post('/mentors', async (req, res) => {
  try {
    const { name, bio, expertise, industry, industries, available, whatsapp_number } = req.body as {
      name: string
      bio: string
      expertise?: string[]
      industry?: string
      industries?: string[]
      available?: boolean
      whatsapp_number?: string
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
      whatsapp_number: normalizePhone(whatsapp_number ?? ''),
      created_at: new Date().toISOString(),
    }

    const ref = await adminDb.collection('mentors').add(doc)

    // Compute and cache embedding — fire-and-forget, never blocks the response
    embedText(mentorEmbedInput(doc), 'RETRIEVAL_DOCUMENT')
      .then((embedding) => ref.update({ embedding }))
      .catch((e) => console.warn('[entities] mentor embed failed:', e))

    await logActivity(adminDb, {
      type: 'MENTOR_CREATED',
      entity_type: 'mentor',
      entity_id: ref.id,
      entity_name: doc.name,
      detail: `Mentor "${doc.name}" added${doc.expertise.length ? ` · ${doc.expertise.slice(0, 3).join(', ')}` : ''}`,
    })
    return res.status(201).json({ id: ref.id, mentor: { id: ref.id, ...doc } })
  } catch (err) {
    console.error('[entities] POST /mentors:', err)
    return res.status(500).json({ error: String(err) })
  }
})

entitiesRouter.patch('/mentors/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['name', 'bio', 'expertise', 'industry', 'industries', 'available', 'whatsapp_number']
    const updates: Record<string, unknown> = {}

    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }

    if ('whatsapp_number' in updates) {
      updates.whatsapp_number = normalizePhone(String(updates.whatsapp_number ?? ''))
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    await adminDb.collection('mentors').doc(id).update(updates)

    // Recompute embedding when any text field changed
    const textFields = ['name', 'bio', 'expertise', 'industry', 'industries']
    if (textFields.some((f) => f in updates)) {
      adminDb.collection('mentors').doc(id).get()
        .then((snap) => {
          if (!snap.exists) return
          const d = snap.data()!
          return embedText(
            mentorEmbedInput({
              name: d.name ?? '',
              bio: d.bio ?? '',
              expertise: d.expertise ?? [],
              industries: d.industries ?? [],
              industry: d.industry ?? '',
            }),
            'RETRIEVAL_DOCUMENT'
          )
        })
        .then((embedding) => embedding && adminDb.collection('mentors').doc(id).update({ embedding }))
        .catch((e) => console.warn('[entities] mentor re-embed failed:', e))
    }

    return res.json({ id })
  } catch (err) {
    console.error('[entities] PATCH /mentors/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── Companies ────────────────────────────────────────────────────────────────

entitiesRouter.post('/companies', async (req, res) => {
  try {
    const { name, industry, stage, problem, goals, size, whatsapp_number } = req.body as {
      name: string
      industry: string
      stage: string
      problem?: string
      goals?: string
      size?: string
      whatsapp_number?: string
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
      whatsapp_number: normalizePhone(whatsapp_number ?? ''),
      created_at: new Date().toISOString(),
    }

    const ref = await adminDb.collection('companies').add(doc)
    await logActivity(adminDb, {
      type: 'COMPANY_CREATED',
      entity_type: 'company',
      entity_id: ref.id,
      entity_name: doc.name,
      detail: `Company "${doc.name}" added · ${doc.industry}, ${doc.stage}`,
    })
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
      wa_group_id: null as string | null,
      mentor_phone: '',
      company_phone: '',
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

    await logActivity(adminDb, {
      type: 'RELATIONSHIP_CREATED',
      entity_type: 'relationship',
      entity_id: ref.id,
      entity_name: `${doc.company_name || company_id} ↔ ${doc.mentor_name || mentor_id}`,
      detail: `Relationship created${match_score ? ` · ${Math.round(match_score * 100)}% match score` : ''}`,
    })

    // Fire-and-forget: fetch phone numbers and auto-create WhatsApp group
    ;(async () => {
      try {
        const [mentorSnap, companySnap] = await Promise.all([
          adminDb.collection('mentors').doc(mentor_id.trim()).get(),
          adminDb.collection('companies').doc(company_id.trim()).get(),
        ])

        const mentorPhone = (mentorSnap.data()?.whatsapp_number as string) ?? ''
        const companyPhone = (companySnap.data()?.whatsapp_number as string) ?? ''

        const phoneUpdate: Record<string, string | null> = {
          mentor_phone: mentorPhone,
          company_phone: companyPhone,
          wa_group_id: null,
        }

        if (mentorPhone && companyPhone) {
          const groupName = `AlignCore: ${doc.company_name || company_id} ↔ ${doc.mentor_name || mentor_id}`
          const groupId = await createWAGroup(groupName, [mentorPhone, companyPhone])
          if (groupId) {
            phoneUpdate.wa_group_id = groupId
            await logActivity(adminDb, {
              type: 'WHATSAPP_GROUP_CREATED',
              entity_type: 'relationship',
              entity_id: ref.id,
              entity_name: `${doc.company_name || company_id} ↔ ${doc.mentor_name || mentor_id}`,
              detail: `WhatsApp group created — mentor and company added automatically`,
            })
            console.log(`[entities] WA group created: ${groupId}`)
          }
        } else {
          console.log(`[entities] Skipping WA group — mentor_phone=${!!mentorPhone} company_phone=${!!companyPhone}`)
        }

        await ref.update(phoneUpdate)
      } catch (e) {
        console.warn('[entities] auto-create WA group failed:', e)
      }
    })()

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
    if ('lifecycle' in updates) {
      await logActivity(adminDb, {
        type: 'LIFECYCLE_CHANGED',
        entity_type: 'relationship',
        entity_id: id,
        entity_name: id,
        detail: `Relationship status changed to ${updates.lifecycle}`,
      })
    }
    return res.json({ id })
  } catch (err) {
    console.error('[entities] PATCH /relationships/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

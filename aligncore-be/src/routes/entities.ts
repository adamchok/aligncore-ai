import { Router } from 'express'
import multer from 'multer'
import { Storage } from '@google-cloud/storage'
import type { Firestore, DocumentReference } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase-admin'
import { logActivity } from '../lib/activity'
import { normalizePhone, createWAGroup } from './waha'

const entityPhotoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const PHOTO_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

let _gcs: Storage | null = null
function getGcs(): Storage {
  if (!_gcs) _gcs = new Storage()
  return _gcs
}

function gcsBucketName(): string {
  return process.env.KNOWLEDGE_BUCKET?.trim() ?? ''
}

function mentorProfileObjectPath(mentorId: string, ext: string): string {
  return `mentors/${mentorId}/profile.${ext}`
}

function companyProfileObjectPath(companyId: string, ext: string): string {
  return `companies/${companyId}/profile.${ext}`
}

function gcsPublicUrl(bucket: string, objectPath: string): string {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/')
  return `https://storage.googleapis.com/${bucket}/${encoded}`
}

/** Firestore batches are capped at 500 writes; stay under for margin. */
const REL_BATCH_SIZE = 450

/** Delete all health-history docs then the relationship document. */
async function deleteRelationshipHistoryAndDoc(db: Firestore, relationshipRef: DocumentReference): Promise<void> {
  const histSnap = await relationshipRef.collection('history').get()
  let batch = db.batch()
  let n = 0
  for (const h of histSnap.docs) {
    batch.delete(h.ref)
    n++
    if (n >= REL_BATCH_SIZE) {
      await batch.commit()
      batch = db.batch()
      n = 0
    }
  }
  if (n > 0) await batch.commit()
  await relationshipRef.delete()
}

async function relationshipPairExists(
  db: Firestore,
  mentorId: string,
  companyId: string,
  excludeRelationshipId?: string
): Promise<boolean> {
  const snap = await db.collection('relationships').where('mentor_id', '==', mentorId).get()
  return snap.docs.some((d) => d.id !== excludeRelationshipId && (d.data()?.company_id as string) === companyId)
}

/** Keep denormalized `company_name` on relationships in sync when a company is renamed. */
async function cascadeCompanyNameToRelationships(
  db: Firestore,
  companyId: string,
  companyName: string
): Promise<void> {
  const snap = await db.collection('relationships').where('company_id', '==', companyId).get()
  if (snap.empty) return
  const docs = snap.docs
  const now = new Date().toISOString()
  for (let i = 0; i < docs.length; i += REL_BATCH_SIZE) {
    const slice = docs.slice(i, i + REL_BATCH_SIZE)
    const batch = db.batch()
    for (const d of slice) {
      batch.update(d.ref, { company_name: companyName, updated_at: now })
    }
    await batch.commit()
  }
}

/** V4 signed read URLs are capped at 604800 seconds (7 days). Stay slightly under to avoid edge rejects. */
const GCS_SIGNED_READ_MAX_MS = 604800 * 1000 - 60_000

/** Upload bytes and return a URL suitable for <img src> (public read preferred; signed URLs expire in ≤7d). */
async function writeProfileImageAndGetUrl(
  bucket: string,
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const file = getGcs().bucket(bucket).file(objectPath)
  try {
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000' },
      predefinedAcl: 'publicRead',
    })
    return gcsPublicUrl(bucket, objectPath)
  } catch {
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000' },
    })
    try {
      await file.makePublic()
      return gcsPublicUrl(bucket, objectPath)
    } catch {
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + GCS_SIGNED_READ_MAX_MS,
      })
      return signedUrl
    }
  }
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
      photo_url: '',
      knowledge_doc_count: 0,
      created_at: new Date().toISOString(),
    }

    const ref = await adminDb.collection('mentors').add(doc)

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
    const allowed = [
      'name',
      'bio',
      'expertise',
      'industry',
      'industries',
      'available',
      'whatsapp_number',
      'photo_url',
    ]
    const raw: Record<string, unknown> = {}

    for (const key of allowed) {
      if (key in req.body) raw[key] = req.body[key]
    }

    if (Object.keys(raw).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const ref = adminDb.collection('mentors').doc(id)
    const existing = await ref.get()
    if (!existing.exists) {
      return res.status(404).json({ error: 'Mentor not found' })
    }

    const updates: Record<string, unknown> = {}

    if ('name' in raw) {
      const name = String(raw.name ?? '').trim()
      if (!name) return res.status(400).json({ error: 'name cannot be empty' })
      updates.name = name
    }
    if ('bio' in raw) {
      const bio = String(raw.bio ?? '').trim()
      if (!bio) return res.status(400).json({ error: 'bio cannot be empty' })
      updates.bio = bio
    }
    if ('industry' in raw) {
      updates.industry = String(raw.industry ?? '').trim()
    }
    if ('expertise' in raw) {
      const exp = raw.expertise
      if (!Array.isArray(exp)) return res.status(400).json({ error: 'expertise must be an array' })
      updates.expertise = exp.map((e: unknown) => String(e).trim()).filter(Boolean)
    }
    if ('industries' in raw) {
      const ind = raw.industries
      if (!Array.isArray(ind)) return res.status(400).json({ error: 'industries must be an array' })
      updates.industries = ind.map((e: unknown) => String(e).trim()).filter(Boolean)
    }
    if ('available' in raw) {
      updates.available = Boolean(raw.available)
    }
    if ('whatsapp_number' in raw) {
      updates.whatsapp_number = normalizePhone(String(raw.whatsapp_number ?? ''))
    }
    if ('photo_url' in raw) {
      const u = String(raw.photo_url ?? '').trim()
      if (u.length > 4096) {
        return res.status(400).json({ error: 'photo_url is too long' })
      }
      updates.photo_url = u
    }

    updates.updated_at = new Date().toISOString()

    await ref.update(updates)

    const merged = { ...existing.data(), ...updates } as Record<string, unknown>
    const nameForLog = (merged.name as string) ?? id

    await logActivity(adminDb, {
      type: 'MENTOR_UPDATED',
      entity_type: 'mentor',
      entity_id: id,
      entity_name: nameForLog,
      detail: 'Mentor profile updated',
    })

    return res.json({ id, mentor: { id, ...merged } })
  } catch (err) {
    console.error('[entities] PATCH /mentors/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

entitiesRouter.post('/mentors/:id/photo', entityPhotoMulter.single('file'), async (req, res) => {
  try {
    const { id } = req.params
    const bucket = gcsBucketName()
    if (!bucket) {
      return res.status(503).json({
        error:
          'Photo upload requires KNOWLEDGE_BUCKET (same GCS bucket as knowledge documents). Set it in aligncore-be/.env.',
      })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'file is required (multipart field name: file)' })
    }

    const mentorRef = adminDb.collection('mentors').doc(id)
    const existing = await mentorRef.get()
    if (!existing.exists) {
      return res.status(404).json({ error: 'Mentor not found' })
    }

    const mime = req.file.mimetype
    const ext = PHOTO_MIME_TO_EXT[mime]
    if (!ext) {
      return res.status(415).json({ error: 'Unsupported image type. Use JPG, PNG, WebP, or GIF.' })
    }

    const objectPath = mentorProfileObjectPath(id, ext)
    const photoUrl = await writeProfileImageAndGetUrl(bucket, objectPath, req.file.buffer, mime)

    const updates = {
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    }
    await mentorRef.update(updates)

    const merged = { ...existing.data(), ...updates } as Record<string, unknown>
    const nameForLog = (merged.name as string) ?? id

    await logActivity(adminDb, {
      type: 'MENTOR_UPDATED',
      entity_type: 'mentor',
      entity_id: id,
      entity_name: nameForLog,
      detail: 'Mentor profile photo updated',
    })

    return res.json({ id, mentor: { id, ...merged } })
  } catch (err) {
    console.error('[entities] POST /mentors/:id/photo:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── Companies ────────────────────────────────────────────────────────────────

entitiesRouter.post('/companies', async (req, res) => {
  try {
    const { name, industry, stage, about, problem, goals, size, whatsapp_number } = req.body as {
      name: string
      industry: string
      stage: string
      about?: string
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
      about: about?.trim() ?? '',
      problem: problem?.trim() ?? '',
      goals: goals?.trim() ?? '',
      size: size?.trim() ?? '',
      whatsapp_number: normalizePhone(whatsapp_number ?? ''),
      photo_url: '',
      knowledge_doc_count: 0,
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

entitiesRouter.patch('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = [
      'name',
      'industry',
      'stage',
      'about',
      'problem',
      'goals',
      'size',
      'whatsapp_number',
      'photo_url',
    ]
    const raw: Record<string, unknown> = {}

    for (const key of allowed) {
      if (key in req.body) raw[key] = req.body[key]
    }

    if (Object.keys(raw).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const ref = adminDb.collection('companies').doc(id)
    const existing = await ref.get()
    if (!existing.exists) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const updates: Record<string, unknown> = {}

    if ('name' in raw) {
      const name = String(raw.name ?? '').trim()
      if (!name) return res.status(400).json({ error: 'name cannot be empty' })
      updates.name = name
    }
    if ('industry' in raw) {
      const industry = String(raw.industry ?? '').trim()
      if (!industry) return res.status(400).json({ error: 'industry cannot be empty' })
      updates.industry = industry
    }
    if ('stage' in raw) {
      const stage = String(raw.stage ?? '').trim()
      if (!stage) return res.status(400).json({ error: 'stage cannot be empty' })
      updates.stage = stage
    }
    if ('about' in raw) {
      updates.about = String(raw.about ?? '').trim()
    }
    if ('problem' in raw) {
      updates.problem = String(raw.problem ?? '').trim()
    }
    if ('goals' in raw) {
      updates.goals = String(raw.goals ?? '').trim()
    }
    if ('size' in raw) {
      updates.size = String(raw.size ?? '').trim()
    }
    if ('whatsapp_number' in raw) {
      updates.whatsapp_number = normalizePhone(String(raw.whatsapp_number ?? ''))
    }
    if ('photo_url' in raw) {
      const u = String(raw.photo_url ?? '').trim()
      if (u.length > 4096) {
        return res.status(400).json({ error: 'photo_url is too long' })
      }
      updates.photo_url = u
    }

    updates.updated_at = new Date().toISOString()

    await ref.update(updates)

    if ('name' in updates) {
      await cascadeCompanyNameToRelationships(adminDb, id, updates.name as string)
    }

    const merged = { ...existing.data(), ...updates } as Record<string, unknown>
    const nameForLog = (merged.name as string) ?? id

    await logActivity(adminDb, {
      type: 'COMPANY_UPDATED',
      entity_type: 'company',
      entity_id: id,
      entity_name: nameForLog,
      detail:
        'name' in updates
          ? 'Company profile updated · mentor relationships refreshed with new name'
          : 'Company profile updated',
    })

    return res.json({ id, company: { id, ...merged } })
  } catch (err) {
    console.error('[entities] PATCH /companies/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

/** Remove company knowledge rows and their GCS objects under `knowledge/company/{id}/`. */
async function deleteCompanyKnowledgeDocs(db: Firestore, companyId: string): Promise<void> {
  const bucketName = gcsBucketName()
  const bucket = bucketName ? getGcs().bucket(bucketName) : null

  const snap = await db
    .collection('knowledge_docs')
    .where('entity_type', '==', 'company')
    .where('entity_id', '==', companyId)
    .get()

  for (const doc of snap.docs) {
    const data = doc.data()
    const filename = typeof data.filename === 'string' ? data.filename : ''
    if (bucket && filename) {
      try {
        await bucket.file(`knowledge/company/${companyId}/${filename}`).delete()
      } catch {
        /* object may already be gone */
      }
    }
    await doc.ref.delete()
  }

  if (bucket) {
    const prefix = `knowledge/company/${companyId}/`
    try {
      const [orphans] = await bucket.getFiles({ prefix })
      await Promise.all(orphans.map((f) => f.delete().catch(() => {})))
    } catch {
      /* non-fatal */
    }
  }
}

/** Remove profile images under `companies/{id}/` in GCS. */
async function deleteCompanyProfileObjects(companyId: string): Promise<void> {
  const bucketName = gcsBucketName()
  if (!bucketName) return
  try {
    const bucket = getGcs().bucket(bucketName)
    const prefix = `companies/${companyId}/`
    const [files] = await bucket.getFiles({ prefix })
    await Promise.all(files.map((f) => f.delete().catch(() => {})))
  } catch {
    /* non-fatal */
  }
}

entitiesRouter.delete('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params
    const ref = adminDb.collection('companies').doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const name = (snap.data()?.name as string) || id

    const relSnap = await adminDb.collection('relationships').where('company_id', '==', id).get()
    for (const d of relSnap.docs) {
      await deleteRelationshipHistoryAndDoc(adminDb, d.ref)
    }

    await deleteCompanyKnowledgeDocs(adminDb, id)
    await deleteCompanyProfileObjects(id)

    await ref.delete()

    await logActivity(adminDb, {
      type: 'COMPANY_DELETED',
      entity_type: 'company',
      entity_id: id,
      entity_name: name,
      detail: `Company deleted · ${relSnap.size} mentor relationship(s) removed`,
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[entities] DELETE /companies/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

entitiesRouter.post('/companies/:id/photo', entityPhotoMulter.single('file'), async (req, res) => {
  try {
    const { id } = req.params
    const bucket = gcsBucketName()
    if (!bucket) {
      return res.status(503).json({
        error:
          'Photo upload requires KNOWLEDGE_BUCKET (same GCS bucket as knowledge documents). Set it in aligncore-be/.env.',
      })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'file is required (multipart field name: file)' })
    }

    const companyRef = adminDb.collection('companies').doc(id)
    const existing = await companyRef.get()
    if (!existing.exists) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const mime = req.file.mimetype
    const ext = PHOTO_MIME_TO_EXT[mime]
    if (!ext) {
      return res.status(415).json({ error: 'Unsupported image type. Use JPG, PNG, WebP, or GIF.' })
    }

    const objectPath = companyProfileObjectPath(id, ext)
    const photoUrl = await writeProfileImageAndGetUrl(bucket, objectPath, req.file.buffer, mime)

    const updates = {
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    }
    await companyRef.update(updates)

    const merged = { ...existing.data(), ...updates } as Record<string, unknown>
    const nameForLog = (merged.name as string) ?? id

    await logActivity(adminDb, {
      type: 'COMPANY_UPDATED',
      entity_type: 'company',
      entity_id: id,
      entity_name: nameForLog,
      detail: 'Company logo / photo updated',
    })

    return res.json({ id, company: { id, ...merged } })
  } catch (err) {
    console.error('[entities] POST /companies/:id/photo:', err)
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

    const mid = mentor_id.trim()
    const cid = company_id.trim()

    if (await relationshipPairExists(adminDb, mid, cid)) {
      return res.status(409).json({ error: 'A relationship already exists for this mentor and company' })
    }

    const now = new Date().toISOString()
    const doc = {
      mentor_id: mid,
      company_id: cid,
      mentor_name: mentor_name?.trim() ?? '',
      company_name: company_name?.trim() ?? '',
      lifecycle: 'ACTIVE',
      engagement: {
        health_score: 0.5,
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
      score: 0.5,
      sentiment: 'NEUTRAL',
      timestamp: now,
    })

    await logActivity(adminDb, {
      type: 'RELATIONSHIP_CREATED',
      entity_type: 'relationship',
      entity_id: ref.id,
      entity_name: `${doc.company_name || cid} ↔ ${doc.mentor_name || mid}`,
      detail: `Relationship created${match_score ? ` · ${Math.round(match_score * 100)}% match score` : ''}`,
    })

    // Fire-and-forget: fetch phone numbers and auto-create WhatsApp group
    ;(async () => {
      try {
        const [mentorSnap, companySnap] = await Promise.all([
          adminDb.collection('mentors').doc(mid).get(),
          adminDb.collection('companies').doc(cid).get(),
        ])

        const mentorPhone = (mentorSnap.data()?.whatsapp_number as string) ?? ''
        const companyPhone = (companySnap.data()?.whatsapp_number as string) ?? ''

        const phoneUpdate: Record<string, string | null> = {
          mentor_phone: mentorPhone,
          company_phone: companyPhone,
          wa_group_id: null,
          wa_group_pending_subject: null,
          wa_group_pending_create_key: null,
        }

        if (mentorPhone && companyPhone) {
          const groupName = `AlignCore: ${doc.company_name || cid} ↔ ${doc.mentor_name || mid}`
          phoneUpdate.wa_group_pending_subject = groupName

          const { jid: groupId, createKey } = await createWAGroup(groupName, [
            mentorPhone,
            companyPhone,
          ])
          phoneUpdate.wa_group_pending_create_key = createKey

          if (groupId) {
            phoneUpdate.wa_group_id = groupId
            phoneUpdate.wa_group_pending_subject = null
            phoneUpdate.wa_group_pending_create_key = null
            await logActivity(adminDb, {
              type: 'WHATSAPP_GROUP_CREATED',
              entity_type: 'relationship',
              entity_id: ref.id,
              entity_name: `${doc.company_name || cid} ↔ ${doc.mentor_name || mid}`,
              detail: `WhatsApp group created — mentor and company added automatically`,
            })
            console.log(`[entities] WA group created: ${groupId}`)
          } else if (createKey) {
            console.log(`[entities] WA group pending (createKey); webhook will set wa_group_id`)
          } else {
            console.log(`[entities] WA group pending (subject); webhook group.v2.join will set wa_group_id`)
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

/** Fetch a single relationship (for admin / non–Firestore clients). */
entitiesRouter.get('/relationships/:id', async (req, res) => {
  try {
    const { id } = req.params
    const snap = await adminDb.collection('relationships').doc(id).get()
    if (!snap.exists) {
      return res.status(404).json({ error: 'Relationship not found' })
    }
    return res.json({ id: snap.id, relationship: { id: snap.id, ...snap.data() } })
  } catch (err) {
    console.error('[entities] GET /relationships/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

const RELATIONSHIP_LIFECYCLES = new Set(['ACTIVE', 'AT_RISK', 'PAUSED', 'COMPLETED', 'DROPPED'])

entitiesRouter.patch('/relationships/:id', async (req, res) => {
  try {
    const { id } = req.params
    const ref = adminDb.collection('relationships').doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return res.status(404).json({ error: 'Relationship not found' })
    }

    const existing = snap.data() as Record<string, unknown>
    const body = req.body as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    let mentorId = String(existing.mentor_id ?? '').trim()
    let companyId = String(existing.company_id ?? '').trim()

    if ('mentor_id' in body) {
      const mid = String(body.mentor_id ?? '').trim()
      if (!mid) return res.status(400).json({ error: 'mentor_id cannot be empty' })
      const mSnap = await adminDb.collection('mentors').doc(mid).get()
      if (!mSnap.exists) return res.status(404).json({ error: 'Mentor not found' })
      mentorId = mid
      updates.mentor_id = mid
      updates.mentor_name = String((mSnap.data()?.name as string) ?? '').trim()
    }

    if ('company_id' in body) {
      const cid = String(body.company_id ?? '').trim()
      if (!cid) return res.status(400).json({ error: 'company_id cannot be empty' })
      const cSnap = await adminDb.collection('companies').doc(cid).get()
      if (!cSnap.exists) return res.status(404).json({ error: 'Company not found' })
      companyId = cid
      updates.company_id = cid
      updates.company_name = String((cSnap.data()?.name as string) ?? '').trim()
    }

    if (
      ('mentor_id' in updates || 'company_id' in updates) &&
      (await relationshipPairExists(adminDb, mentorId, companyId, id))
    ) {
      return res.status(409).json({ error: 'Another relationship already exists for this mentor and company' })
    }

    if ('lifecycle' in body) {
      const lc = String(body.lifecycle ?? '').trim()
      if (!RELATIONSHIP_LIFECYCLES.has(lc)) return res.status(400).json({ error: 'Invalid lifecycle' })
      updates.lifecycle = lc
    }

    if ('notes' in body) {
      const notes = body.notes
      if (notes === null || notes === undefined) updates.notes = null
      else {
        const s = String(notes).trim()
        updates.notes = s.length ? s : null
      }
    }

    if ('wa_group_id' in body) {
      const g = String(body.wa_group_id ?? '').trim()
      updates.wa_group_id = g.length ? g : null
      if (g.length) {
        updates.wa_group_pending_subject = null
        updates.wa_group_pending_create_key = null
      }
    }

    if ('mentor_phone' in body) {
      updates.mentor_phone = normalizePhone(String(body.mentor_phone ?? ''))
    }
    if ('company_phone' in body) {
      updates.company_phone = normalizePhone(String(body.company_phone ?? ''))
    }

    if ('match_score' in body) {
      const ms = body.match_score
      if (ms === null || ms === '') updates.match_score = null
      else {
        const n = Number(ms)
        if (!Number.isFinite(n) || n < 0 || n > 1) {
          return res.status(400).json({ error: 'match_score must be between 0 and 1' })
        }
        updates.match_score = n
      }
    }

    if ('match_reasoning' in body) {
      const mr = body.match_reasoning
      if (mr === null || mr === undefined) updates.match_reasoning = null
      else {
        const s = String(mr).trim()
        updates.match_reasoning = s.length ? s : null
      }
    }

    const existingEng = (existing.engagement ?? {}) as Record<string, unknown>
    if (
      'engagement' in body &&
      body.engagement !== undefined &&
      typeof body.engagement === 'object' &&
      body.engagement !== null &&
      !Array.isArray(body.engagement)
    ) {
      const merged = { ...existingEng, ...(body.engagement as Record<string, unknown>) }
      delete merged.sessions_completed
      delete merged.next_session
      updates.engagement = merged
    }

    const existingComms = (existing.comms ?? {}) as Record<string, unknown>
    if (
      'comms' in body &&
      body.comms !== undefined &&
      typeof body.comms === 'object' &&
      body.comms !== null &&
      !Array.isArray(body.comms)
    ) {
      updates.comms = { ...existingComms, ...(body.comms as Record<string, unknown>) }
    }

    if ('ai_summary' in body) {
      const s = body.ai_summary
      if (s === null || s === undefined) updates.ai_summary = null
      else updates.ai_summary = String(s).trim() || null
    }

    const keysNoTs = Object.keys(updates).filter((k) => k !== 'updated_at')
    if (keysNoTs.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    updates.updated_at = new Date().toISOString()

    await ref.update(updates)

    const fresh = await ref.get()
    if (!fresh.exists) {
      return res.status(500).json({ error: 'Relationship missing after update' })
    }
    const relationship = { id: fresh.id, ...fresh.data() }

    const displayName = `${updates.company_name ?? existing.company_name ?? companyId} ↔ ${updates.mentor_name ?? existing.mentor_name ?? mentorId}`

    if ('lifecycle' in updates) {
      await logActivity(adminDb, {
        type: 'LIFECYCLE_CHANGED',
        entity_type: 'relationship',
        entity_id: id,
        entity_name: String(displayName),
        detail: `Relationship status changed to ${updates.lifecycle}`,
      })
    }

    const otherKeys = keysNoTs.filter((k) => k !== 'lifecycle')
    if (otherKeys.length > 0) {
      await logActivity(adminDb, {
        type: 'RELATIONSHIP_UPDATED',
        entity_type: 'relationship',
        entity_id: id,
        entity_name: String(displayName),
        detail: `Updated: ${otherKeys.sort().join(', ')}`,
      })
    }

    return res.json({ id, relationship })
  } catch (err) {
    console.error('[entities] PATCH /relationships/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

entitiesRouter.delete('/relationships/:id', async (req, res) => {
  try {
    const { id } = req.params
    const ref = adminDb.collection('relationships').doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return res.status(404).json({ error: 'Relationship not found' })
    }
    const d = snap.data()!
    const entityName = `${d.company_name ?? d.company_id} ↔ ${d.mentor_name ?? d.mentor_id}`

    await deleteRelationshipHistoryAndDoc(adminDb, ref)

    await logActivity(adminDb, {
      type: 'RELATIONSHIP_DELETED',
      entity_type: 'relationship',
      entity_id: id,
      entity_name: entityName,
      detail: 'Relationship and health history deleted',
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[entities] DELETE /relationships/:id:', err)
    return res.status(500).json({ error: String(err) })
  }
})

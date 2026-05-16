import { Router } from 'express'
import multer from 'multer'
import { Storage } from '@google-cloud/storage'
import { adminDb } from '../lib/firebase-admin'
import { genai, GEMINI_MODEL } from '../lib/genai'
import { logActivity } from '../lib/activity'

export const knowledgeRouter = Router()

const BUCKET_NAME = process.env.KNOWLEDGE_BUCKET?.trim() ?? ''

// Lazily initialise GCS — only used when KNOWLEDGE_BUCKET is set
let _storage: Storage | null = null
function getStorage(): Storage {
  if (!_storage) _storage = new Storage()
  return _storage
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
})

const SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
}

const ENTITY_TYPES = new Set(['company', 'mentor'])

// ── Helpers ──────────────────────────────────────────────────────────────────

function gcsPath(entityType: string, entityId: string, filename: string): string {
  return `knowledge/${entityType}/${entityId}/${filename}`
}

async function syncEntityKnowledgeDocCount(entityType: 'company' | 'mentor', entityId: string): Promise<void> {
  try {
    const snap = await adminDb
      .collection('knowledge_docs')
      .where('entity_type', '==', entityType)
      .where('entity_id', '==', entityId)
      .get()
    const coll = entityType === 'mentor' ? 'mentors' : 'companies'
    await adminDb.collection(coll).doc(entityId).update({
      knowledge_doc_count: snap.size,
    })
  } catch {
    // non-fatal — list UI falls back to unknown count
  }
}

async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  const base64 = buffer.toString('base64')

  try {
    const result = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: 'Extract all readable text from this document. Return only the plain text, no formatting.' },
          ],
        },
      ],
    })
    return result.text?.trim() ?? ''
  } catch {
    return ''
  }
}

// ── POST /api/knowledge/:entityType/:entityId/upload ──────────────────────────

knowledgeRouter.post(
  '/:entityType/:entityId/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      const { entityType, entityId } = req.params

      if (!ENTITY_TYPES.has(entityType)) {
        return res.status(400).json({ error: 'entityType must be "company" or "mentor"' })
      }

      if (!req.file) {
        return res.status(400).json({ error: 'file is required' })
      }

      const { buffer, originalname, mimetype } = req.file
      const ext = originalname.split('.').pop()?.toLowerCase() ?? ''
      const resolvedMime = Object.keys(SUPPORTED_TYPES).find(m => m === mimetype)
        ?? (ext === 'pdf' ? 'application/pdf' : mimetype)

      if (!SUPPORTED_TYPES[resolvedMime]) {
        return res.status(415).json({ error: 'Unsupported file type. Use PDF, DOCX, PPTX, or TXT.' })
      }

      // Verify entity exists
      const collection = entityType === 'company' ? 'companies' : 'mentors'
      const entitySnap = await adminDb.collection(collection).doc(entityId).get()
      if (!entitySnap.exists) {
        return res.status(404).json({ error: `${entityType} not found` })
      }

      // Upload to GCS
      let gcsUri = ''
      if (BUCKET_NAME) {
        const storage = getStorage()
        const path = gcsPath(entityType, entityId, originalname)
        await storage.bucket(BUCKET_NAME).file(path).save(buffer, { contentType: resolvedMime })
        gcsUri = `gs://${BUCKET_NAME}/${path}`
      }

      // Extract text via Gemini
      const extractedText = await extractTextFromFile(buffer, resolvedMime)

      // Save metadata to Firestore
      const docRef = await adminDb.collection('knowledge_docs').add({
        entity_type: entityType,
        entity_id: entityId,
        filename: originalname,
        gcs_path: gcsUri,
        mime_type: resolvedMime,
        extracted_text: extractedText,
        uploaded_at: new Date().toISOString(),
      })

      await logActivity(adminDb, {
        type: 'KNOWLEDGE_UPLOADED',
        entity_type: entityType as 'company' | 'mentor',
        entity_id: entityId,
        entity_name: (entitySnap.data()?.name as string) || entityId,
        detail: `Uploaded "${originalname}" to knowledge base`,
      })

      await syncEntityKnowledgeDocCount(entityType as 'company' | 'mentor', entityId)

      return res.status(201).json({
        docId: docRef.id,
        filename: originalname,
        extracted_text_preview: extractedText.slice(0, 200),
        gcs_path: gcsUri || null,
      })
    } catch (err) {
      console.error('[knowledge] upload error:', err)
      return res.status(500).json({ error: String(err) })
    }
  }
)

// ── GET /api/knowledge/:entityType/:entityId ──────────────────────────────────

knowledgeRouter.get('/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params

    if (!ENTITY_TYPES.has(entityType)) {
      return res.status(400).json({ error: 'entityType must be "company" or "mentor"' })
    }

    const snap = await adminDb
      .collection('knowledge_docs')
      .where('entity_type', '==', entityType)
      .where('entity_id', '==', entityId)
      .get()

    const docs = snap.docs
      .map(d => {
        const data = d.data()
        return {
          docId: d.id,
          filename: data.filename as string,
          mime_type: data.mime_type as string,
          gcs_path: (data.gcs_path as string) || null,
          uploaded_at: data.uploaded_at as string,
        }
      })
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))

    return res.json({ documents: docs })
  } catch (err) {
    console.error('[knowledge] list error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// ── DELETE /api/knowledge/:entityType/:entityId/:docId ────────────────────────

knowledgeRouter.delete('/:entityType/:entityId/:docId', async (req, res) => {
  try {
    const { entityType, entityId, docId } = req.params

    const docSnap = await adminDb.collection('knowledge_docs').doc(docId).get()
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' })

    const data = docSnap.data()!
    if (data.entity_type !== entityType || data.entity_id !== entityId) {
      return res.status(403).json({ error: 'Document does not belong to this entity' })
    }

    // Delete from GCS if path exists
    if (BUCKET_NAME && data.gcs_path) {
      try {
        const path = gcsPath(entityType, entityId, data.filename)
        await getStorage().bucket(BUCKET_NAME).file(path).delete()
      } catch {
        // Non-fatal: GCS object may already be gone
      }
    }

    await adminDb.collection('knowledge_docs').doc(docId).delete()

    await syncEntityKnowledgeDocCount(entityType as 'company' | 'mentor', entityId)

    return res.json({ deleted: docId })
  } catch (err) {
    console.error('[knowledge] delete error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

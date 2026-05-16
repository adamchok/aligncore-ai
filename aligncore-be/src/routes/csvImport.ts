import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { logActivity } from '../lib/activity'

export const csvImportRouter = Router()

interface CompanyRow {
  name: string
  industry: string
  stage: string
  problem?: string
  goals?: string
  size?: string
}

csvImportRouter.post('/companies/batch', async (req, res) => {
  try {
    const { rows } = req.body as { rows: CompanyRow[] }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' })
    }

    if (rows.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 rows per import' })
    }

    const ids: string[] = []
    const errors: string[] = []
    const now = new Date().toISOString()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.name?.trim() || !row.industry?.trim() || !row.stage?.trim()) {
        errors.push(`Row ${i + 1}: name, industry, and stage are required`)
        continue
      }
      try {
        const doc = {
          name: row.name.trim(),
          industry: row.industry.trim(),
          stage: row.stage.trim(),
          problem: row.problem?.trim() ?? '',
          goals: row.goals?.trim() ?? '',
          size: row.size?.trim() ?? '',
          created_at: now,
        }
        const ref = await adminDb.collection('companies').add(doc)
        ids.push(ref.id)
      } catch (err) {
        errors.push(`Row ${i + 1} (${row.name}): ${String(err)}`)
      }
    }

    if (ids.length > 0) {
      await logActivity(adminDb, {
        type: 'CSV_IMPORT',
        entity_type: 'company',
        entity_id: 'batch',
        entity_name: `${ids.length} companies`,
        detail: `Bulk import: ${ids.length} companies added${errors.length ? `, ${errors.length} skipped` : ''}`,
      })
    }

    return res.status(201).json({ created: ids.length, ids, errors })
  } catch (err) {
    console.error('[csvImport] POST /companies/batch:', err)
    return res.status(500).json({ error: String(err) })
  }
})

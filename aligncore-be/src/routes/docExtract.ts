import { Router } from 'express'
import multer from 'multer'
import mammoth from 'mammoth'
import AdmZip from 'adm-zip'
import { genai, MODELS } from '../lib/gemini'
import { generateText } from '../lib/ai'
import { logActivity } from '../lib/activity'
import { adminDb } from '../lib/firebase-admin'

export const docExtractRouter = Router()

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

const EXTENSION_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    const ext = '.' + (file.originalname.split('.').pop() ?? '').toLowerCase()
    const byMime = SUPPORTED_MIME_TYPES.has(file.mimetype)
    const byExt = ext in EXTENSION_MIME
    if (byMime || byExt) return cb(null, true)
    cb(new Error('Only PDF, DOCX, and PPTX files are supported'))
  },
})

const INDUSTRIES = ['FinTech', 'HealthTech', 'EdTech', 'SaaS', 'E-Commerce', 'DeepTech', 'CleanTech', 'Other']
const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage']

const EXTRACT_PROMPT = `Extract a structured company profile from the document content below.
Reply with JSON only — no markdown, no explanation, no extra keys.

Schema:
{
  "name": "company name",
  "industry": "one of: ${INDUSTRIES.join(', ')}",
  "stage": "one of: ${STAGES.join(', ')}",
  "problem": "1-2 sentences describing the problem they solve",
  "goals": "1-2 sentences describing their goals or what they want from mentorship",
  "size": "team size as a string e.g. '5-10', or empty string if unknown"
}

Use empty string "" for any field that cannot be confidently inferred.`

// ── Text extractors ──────────────────────────────────────────────────────────

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

function extractTextFromPptx(buffer: Buffer): string {
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()
  const slideEntries = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName))

  let text = ''
  for (const entry of slideEntries) {
    const xml = entry.getData().toString('utf8')
    // Extract text content from <a:t> elements (DrawingML text runs)
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? []
    const slideText = matches
      .map((m) => m.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
      .join(' ')
    if (slideText) text += slideText + '\n'
  }
  return text.trim()
}

// ── Route ────────────────────────────────────────────────────────────────────

docExtractRouter.post('/extract-doc', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required (PDF, DOCX, or PPTX)' })
    }

    const { buffer, originalname, mimetype } = req.file
    const ext = '.' + (originalname.split('.').pop() ?? '').toLowerCase()
    const resolvedMime = EXTENSION_MIME[ext] ?? mimetype

    let profile = { name: '', industry: '', stage: '', problem: '', goals: '', size: '' }

    // ── PDF: Gemini multimodal (native PDF understanding) ────────────────────
    if (resolvedMime === 'application/pdf') {
      const base64 = buffer.toString('base64')
      const result = await genai.models.generateContent({
        model: MODELS.flash,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64,
                  mimeType: 'application/pdf',
                },
              },
              { text: EXTRACT_PROMPT },
            ],
          },
        ],
      })
      const raw = result.text ?? ''
      const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
      try {
        const parsed = JSON.parse(clean) as Partial<typeof profile>
        profile = {
          name: parsed.name?.trim() ?? '',
          industry: INDUSTRIES.includes(parsed.industry ?? '') ? (parsed.industry ?? '') : '',
          stage: STAGES.includes(parsed.stage ?? '') ? (parsed.stage ?? '') : '',
          problem: parsed.problem?.trim() ?? '',
          goals: parsed.goals?.trim() ?? '',
          size: parsed.size?.trim() ?? '',
        }
      } catch {
        // Return empty profile on parse failure
      }
    }

    // ── DOCX: mammoth text extraction → Gemini text ──────────────────────────
    else if (resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const text = await extractTextFromDocx(buffer)
      if (!text) {
        return res.status(422).json({ error: 'Could not extract text from DOCX — document may be empty or protected' })
      }
      const prompt = `${EXTRACT_PROMPT}\n\nDocument content:\n"""\n${text.slice(0, 3000)}\n"""`
      const raw = await generateText(prompt)
      const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
      try {
        const parsed = JSON.parse(clean) as Partial<typeof profile>
        profile = {
          name: parsed.name?.trim() ?? '',
          industry: INDUSTRIES.includes(parsed.industry ?? '') ? (parsed.industry ?? '') : '',
          stage: STAGES.includes(parsed.stage ?? '') ? (parsed.stage ?? '') : '',
          problem: parsed.problem?.trim() ?? '',
          goals: parsed.goals?.trim() ?? '',
          size: parsed.size?.trim() ?? '',
        }
      } catch {
        // Return empty profile on parse failure
      }
    }

    // ── PPTX: slide XML text extraction → Gemini text ────────────────────────
    else if (resolvedMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const text = extractTextFromPptx(buffer)
      if (!text) {
        return res.status(422).json({ error: 'Could not extract text from PPTX — presentation may be empty or use unsupported features' })
      }
      const prompt = `${EXTRACT_PROMPT}\n\nPresentation slide content:\n"""\n${text.slice(0, 3000)}\n"""`
      const raw = await generateText(prompt)
      const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
      try {
        const parsed = JSON.parse(clean) as Partial<typeof profile>
        profile = {
          name: parsed.name?.trim() ?? '',
          industry: INDUSTRIES.includes(parsed.industry ?? '') ? (parsed.industry ?? '') : '',
          stage: STAGES.includes(parsed.stage ?? '') ? (parsed.stage ?? '') : '',
          problem: parsed.problem?.trim() ?? '',
          goals: parsed.goals?.trim() ?? '',
          size: parsed.size?.trim() ?? '',
        }
      } catch {
        // Return empty profile on parse failure
      }
    } else {
      return res.status(415).json({ error: 'Unsupported file type. Use PDF, DOCX, or PPTX.' })
    }

    await logActivity(adminDb, {
      type: 'AI_EXTRACT',
      entity_type: 'company',
      entity_id: 'doc-extract',
      entity_name: profile.name || originalname,
      detail: `AI extracted company profile from "${originalname}" (${ext.slice(1).toUpperCase()})${profile.name ? ` — "${profile.name}"` : ''}`,
    })

    return res.json({ profile, source_file: originalname })
  } catch (err) {
    console.error('[docExtract] POST /extract-doc:', err)
    if ((err as NodeJS.ErrnoException).message?.includes('LIMIT_FILE_SIZE')) {
      return res.status(413).json({ error: 'File too large — maximum 15 MB' })
    }
    if ((err as NodeJS.ErrnoException).message?.includes('Only PDF')) {
      return res.status(415).json({ error: (err as Error).message })
    }
    return res.status(500).json({ error: String(err) })
  }
})

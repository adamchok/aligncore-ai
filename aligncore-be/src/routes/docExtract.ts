import { Router } from 'express'
import multer from 'multer'
import mammoth from 'mammoth'
import AdmZip from 'adm-zip'
import { genai, GEMINI_MODEL } from '../lib/genai'
import { runAgent } from '../lib/adk'
import { extractAgent } from '../lib/agents/extractAgent'
import { mentorExtractAgent } from '../lib/agents/mentorExtractAgent'
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

/** User-message prompt for PDF multimodal extraction (mirrors extractAgent instruction). */
const COMPANY_PDF_EXTRACT_PROMPT = `## Role
You are AlignCore AI's company-profile extraction specialist: precise, neutral, accelerator context.

## Task
Read the attached document and infer one structured company profile.

## Input
The PDF/PPTX/DOCX attached with this message is the only source. Do not invent facts.

## Output
Return one JSON object only — no markdown fences, no commentary — keys exactly:
{"name":"","industry":"one of FinTech|HealthTech|EdTech|SaaS|E-Commerce|DeepTech|CleanTech|Other","stage":"one of Pre-seed|Seed|Series A|Series B|Growth|Late Stage","about":"","problem":"","goals":"","size":""}

## Constraints
- JSON only, parseable as a single object.
- industry and stage must be exactly one allowed literal or empty string.
- about describes what the company does / builds (overview); problem is the pain point — keep them distinct when both appear.
- goals may be inferred from mission, roadmap, fundraising, or use-of-funds when mentorship goals are unstated.
- Use "" for unknown fields.

## Final reminder
Respond with raw JSON only — one object, no text before or after.`

const EXPERTISE_TAGS = ['Product', 'Growth', 'Fundraising', 'Engineering', 'Design', 'Operations', 'Marketing', 'Sales', 'Legal', 'Finance', 'HR', 'Strategy']

const MENTOR_PDF_EXTRACT_PROMPT = `## Role
You are AlignCore AI's mentor-profile extraction specialist: factual and CV-aware.

## Task
Read the attached document and infer one mentor profile.

## Input
The attached file is the only evidence.

## Output
Return one JSON object only — no markdown — keys exactly:
{"name":"","bio":"2-3 sentence professional summary","industry":"primary industry label or empty","expertise":[]}

Expertise array: include only tags from this closed set (exact spelling): ${EXPERTISE_TAGS.join(', ')}. Empty array if none apply.

## Constraints
- JSON only; no invented employers or achievements; expertise values must be exactly from the list above.

## Final reminder
Raw JSON object only.`

// ── Helpers ───────────────────────────────────────────────────────────────────

type ProfileShape = {
  name: string
  industry: string
  stage: string
  about: string
  problem: string
  goals: string
  size: string
}

function parseProfile(raw: string, industries: string[], stages: string[]): ProfileShape {
  // Strip markdown fences, then try to find a JSON object anywhere in the text
  const stripped = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match)
    return { name: '', industry: '', stage: '', about: '', problem: '', goals: '', size: '' }
  try {
    const parsed = JSON.parse(match[0]) as Partial<ProfileShape>
    return {
      name: parsed.name?.trim() ?? '',
      industry: industries.includes(parsed.industry ?? '') ? (parsed.industry ?? '') : '',
      stage: stages.includes(parsed.stage ?? '') ? (parsed.stage ?? '') : '',
      about: parsed.about?.trim() ?? '',
      problem: parsed.problem?.trim() ?? '',
      goals: parsed.goals?.trim() ?? '',
      size: parsed.size?.trim() ?? '',
    }
  } catch {
    return { name: '', industry: '', stage: '', about: '', problem: '', goals: '', size: '' }
  }
}

// ── Text extractors ──────────────────────────────────────────────────────────

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

function slideNum(entryName: string): number {
  return parseInt(entryName.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10)
}

function extractTextFromPptx(buffer: Buffer): string {
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()
  const slideEntries = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => slideNum(a.entryName) - slideNum(b.entryName))

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

    let profile: ProfileShape = { name: '', industry: '', stage: '', about: '', problem: '', goals: '', size: '' }

    // ── PDF: Gemini multimodal (native PDF understanding) ────────────────────
    if (resolvedMime === 'application/pdf') {
      const base64 = buffer.toString('base64')
      const result = await genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64, mimeType: 'application/pdf' } },
              { text: COMPANY_PDF_EXTRACT_PROMPT },
            ],
          },
        ],
      })
      profile = parseProfile(result.text ?? '', INDUSTRIES, STAGES)
    }

    // ── DOCX: mammoth text extraction → agent ────────────────────────────────
    else if (resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const text = await extractTextFromDocx(buffer)
      if (!text) {
        return res.status(422).json({ error: 'Could not extract text from DOCX — document may be empty or protected' })
      }
      profile = parseProfile(await runAgent(extractAgent, text.slice(0, 6000)), INDUSTRIES, STAGES)
    }

    // ── PPTX: slide XML text extraction → agent ───────────────────────────────
    else if (resolvedMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const text = extractTextFromPptx(buffer)
      if (!text) {
        return res.status(422).json({ error: 'Could not extract text from PPTX — presentation may be empty or use unsupported features' })
      }
      profile = parseProfile(await runAgent(extractAgent, text.slice(0, 6000)), INDUSTRIES, STAGES)
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

// ── Mentor profile extraction ─────────────────────────────────────────────────

type MentorProfileShape = { name: string; bio: string; industry: string; expertise: string[] }

function parseMentorProfile(raw: string): MentorProfileShape {
  const stripped = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) return { name: '', bio: '', industry: '', expertise: [] }
  try {
    const parsed = JSON.parse(match[0]) as Partial<MentorProfileShape>
    return {
      name: parsed.name?.trim() ?? '',
      bio: parsed.bio?.trim() ?? '',
      industry: parsed.industry?.trim() ?? '',
      expertise: Array.isArray(parsed.expertise)
        ? parsed.expertise
            .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
            .map((e) => e.trim())
        : [],
    }
  } catch {
    return { name: '', bio: '', industry: '', expertise: [] }
  }
}

// Extract plain text from any supported file (used to build multi-doc context)
async function extractRawText(buffer: Buffer, resolvedMime: string): Promise<string> {
  if (resolvedMime === 'application/pdf') {
    try {
      const result = await genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: buffer.toString('base64'), mimeType: 'application/pdf' } },
            { text: 'Extract all readable text from this document. Return only the plain text, no formatting.' },
          ],
        }],
      })
      return result.text?.trim() ?? ''
    } catch {
      return ''
    }
  }
  if (resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(buffer)
  }
  if (resolvedMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return extractTextFromPptx(buffer)
  }
  return ''
}

const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

docExtractRouter.post('/extract-mentor-doc', uploadMulti.array('files', 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined
    if (!files?.length) {
      return res.status(400).json({ error: 'At least one file is required (PDF, DOCX, or PPTX)' })
    }

    // Extract text from each file and label by filename for context
    const parts: string[] = []
    for (const file of files) {
      const ext = '.' + (file.originalname.split('.').pop() ?? '').toLowerCase()
      const mime = EXTENSION_MIME[ext] ?? file.mimetype
      if (!SUPPORTED_MIME_TYPES.has(mime)) continue
      const text = await extractRawText(file.buffer, mime)
      if (text) parts.push(`=== ${file.originalname} ===\n${text}`)
    }

    if (!parts.length) {
      return res.status(422).json({ error: 'Could not extract text from any uploaded file' })
    }

    const combined = parts.join('\n\n').slice(0, 15000)
    const profile = parseMentorProfile(await runAgent(mentorExtractAgent, combined))

    return res.json({ profile, source_files: files.map((f) => f.originalname) })
  } catch (err) {
    console.error('[docExtract] POST /extract-mentor-doc:', err)
    if ((err as NodeJS.ErrnoException).message?.includes('LIMIT_FILE_SIZE')) {
      return res.status(413).json({ error: 'File too large — maximum 15 MB per file' })
    }
    return res.status(500).json({ error: String(err) })
  }
})

import { Router } from 'express'
import { generateText } from '../lib/ai'
import { logActivity } from '../lib/activity'
import { adminDb } from '../lib/firebase-admin'

export const aiExtractRouter = Router()

interface ExtractedProfile {
  name: string
  industry: string
  stage: string
  problem: string
  goals: string
  size: string
}

const INDUSTRIES = ['FinTech', 'HealthTech', 'EdTech', 'SaaS', 'E-Commerce', 'DeepTech', 'CleanTech', 'Other']
const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage']

aiExtractRouter.post('/extract', async (req, res) => {
  try {
    const { text } = req.body as { text: string }

    if (!text?.trim()) {
      return res.status(400).json({ error: 'text is required' })
    }

    if (text.trim().length < 20) {
      return res.status(400).json({ error: 'text is too short to extract a meaningful profile' })
    }

    const prompt = `Extract a structured company profile from the text below.
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

Use empty string "" for any field that cannot be confidently inferred.

Text:
"""
${text.trim().slice(0, 2000)}
"""`

    const raw = await generateText(prompt)
    const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()

    let profile: ExtractedProfile = { name: '', industry: '', stage: '', problem: '', goals: '', size: '' }

    try {
      const parsed = JSON.parse(clean) as Partial<ExtractedProfile>
      profile = {
        name: parsed.name?.trim() ?? '',
        industry: INDUSTRIES.includes(parsed.industry ?? '') ? (parsed.industry ?? '') : '',
        stage: STAGES.includes(parsed.stage ?? '') ? (parsed.stage ?? '') : '',
        problem: parsed.problem?.trim() ?? '',
        goals: parsed.goals?.trim() ?? '',
        size: parsed.size?.trim() ?? '',
      }
    } catch {
      // Return empty profile rather than 500 — FE handles gracefully
    }

    await logActivity(adminDb, {
      type: 'AI_EXTRACT',
      entity_type: 'company',
      entity_id: 'extract',
      entity_name: profile.name || 'Unknown',
      detail: `AI extracted company profile${profile.name ? ` for "${profile.name}"` : ''}`,
    })

    return res.json({ profile })
  } catch (err) {
    console.error('[aiExtract] POST /extract:', err)
    return res.status(500).json({ error: String(err) })
  }
})

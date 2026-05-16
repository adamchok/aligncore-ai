import { Router } from 'express'
import { runAgent } from '../lib/adk'
import { matchAgent } from '../lib/agents/matchAgent'

export const matchRouter = Router()

interface CompanyProfile {
  id?: string
  name?: string
  industry?: string
  stage?: string
  about?: string
  problem?: string
  goals?: string
  /** legacy alias */
  challenge?: string
  mentor_expertise?: string
  size?: string
}

interface MatchResult {
  id: string
  name: string
  industry: string
  expertise: string[]
  bio: string
  ai_match_score: number
  reasoning: string
  rank: number
}

matchRouter.post('/', async (req, res) => {
  try {
    const { company_profile } = req.body as { company_profile: CompanyProfile }

    if (!company_profile) {
      return res.status(400).json({ error: 'company_profile is required' })
    }

    if (!company_profile.name?.trim()) {
      return res.status(400).json({ error: 'company_profile.name is required' })
    }

    // Normalize legacy field
    const profile = {
      ...company_profile,
      problem: company_profile.problem ?? company_profile.challenge,
    }

    const prompt = company_profile.id
      ? `Company ID for knowledge lookup: ${company_profile.id}\n\nCompany profile:\n${JSON.stringify(profile, null, 2)}`
      : `Company profile:\n${JSON.stringify(profile, null, 2)}`

    const raw = await runAgent(matchAgent, prompt)
    const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()

    let matches: MatchResult[] = []
    try {
      matches = JSON.parse(clean) as MatchResult[]
      matches.sort((a, b) => a.rank - b.rank)
    } catch {
      console.warn('[match] Failed to parse agent response as JSON')
    }

    return res.json({ matches })
  } catch (err) {
    console.error('[match] error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

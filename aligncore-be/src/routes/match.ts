import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { embedText, cosineSimilarity } from '../lib/gemini'
import { generateText } from '../lib/ai'

export const matchRouter = Router()

interface CompanyProfile {
  name?: string
  industry?: string
  stage?: string
  problem?: string
  goals?: string
  /** legacy alias */
  challenge?: string
  mentor_expertise?: string
  size?: string
}

interface MentorDoc {
  id: string
  name: string
  expertise: string[]
  bio: string
  industries?: string[]
  /** optional curated single label */
  industry?: string
  available?: boolean
  /** cached embedding — written by entities.ts on create/update */
  embedding?: number[]
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

function mentorIndustryLabel(m: MentorDoc): string {
  if (m.industry?.trim()) return m.industry.trim()
  const first = m.industries?.filter(Boolean)?.[0]
  if (first) return first
  return ''
}

function problemFrom(profile: CompanyProfile): string | undefined {
  return profile.problem ?? profile.challenge
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

    const problem = problemFrom(company_profile)
    const goals = company_profile.goals

    const profileText = [
      company_profile.name,
      company_profile.industry,
      company_profile.stage,
      problem,
      goals,
      company_profile.mentor_expertise,
      company_profile.size,
    ]
      .filter(Boolean)
      .join('. ')

    const profileEmbedding = await embedText(profileText, 'RETRIEVAL_QUERY')

    let mentorsSnap = await adminDb.collection('mentors').where('available', '==', true).get()

    if (mentorsSnap.empty) {
      mentorsSnap = await adminDb.collection('mentors').get()
    }

    const mentors = mentorsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MentorDoc))

    if (mentors.length === 0) {
      return res.json({ matches: [] })
    }

    const scored = await Promise.all(
      mentors.map(async (mentor) => {
        let mentorEmbedding: number[]

        const cached = mentor.embedding
        if (cached?.length && cached.length === profileEmbedding.length) {
          mentorEmbedding = cached
        } else {
          // No cache, wrong length (old model), or empty: compute and persist
          const mentorText = [
            mentor.name,
            mentor.bio,
            ...(mentor.expertise ?? []),
            ...(mentor.industries ?? []),
            mentor.industry,
          ]
            .filter(Boolean)
            .join('. ')

          mentorEmbedding = await embedText(mentorText, 'RETRIEVAL_DOCUMENT')

          // Cache for next time — fire-and-forget
          adminDb.collection('mentors').doc(mentor.id)
            .update({ embedding: mentorEmbedding })
            .catch(() => {})
        }

        return { mentor, score: cosineSimilarity(profileEmbedding, mentorEmbedding) }
      })
    )

    const top3 = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ mentor, score }) => ({ mentor, score }))

    const rerankPrompt = `
You are an expert startup mentor matching system for AlignCore AI.

Company Profile:
${JSON.stringify(company_profile, null, 2)}

Top 3 mentor candidates (pre-ranked by vector similarity):
${top3
  .map(
    ({ mentor, score }, i) =>
      `${i + 1}. ${mentor.name} (${mentorIndustryLabel(mentor)}) cosine=${score.toFixed(3)}
   id: ${mentor.id}
   Expertise: ${(mentor.expertise ?? []).join(', ')}
   Bio: ${mentor.bio}`
  )
  .join('\n\n')}

Re-rank these mentors for the best fit and provide a 1-sentence reasoning for each.
Reply with JSON only (no markdown):
[
  { "id": "mentor_id", "rank": 1, "ai_match_score": 0.00-1.00, "reasoning": "..." },
  { "id": "mentor_id", "rank": 2, "ai_match_score": 0.00-1.00, "reasoning": "..." },
  { "id": "mentor_id", "rank": 3, "ai_match_score": 0.00-1.00, "reasoning": "..." }
]
`

    const raw = await generateText(rerankPrompt)
    let rankings: Array<{ id: string; rank: number; ai_match_score: number; reasoning: string }> =
      []

    try {
      const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
      rankings = JSON.parse(clean)
    } catch {
      rankings = top3.map(({ mentor, score }, i) => ({
        id: mentor.id,
        rank: i + 1,
        ai_match_score: score,
        reasoning: 'Strong domain alignment based on semantic similarity.',
      }))
    }

    const merged: MatchResult[] = rankings
      .map((r) => {
        const found = top3.find(({ mentor }) => mentor.id === r.id)
        if (!found) return null
        const m = found.mentor
        return {
          id: m.id,
          name: m.name,
          industry: mentorIndustryLabel(m),
          expertise: m.expertise ?? [],
          bio: m.bio,
          ai_match_score: r.ai_match_score,
          reasoning: r.reasoning,
          rank: r.rank,
        }
      })
      .filter(Boolean) as MatchResult[]

    merged.sort((a, b) => a.rank - b.rank)

    return res.json({ matches: merged })
  } catch (err) {
    console.error('[match] error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

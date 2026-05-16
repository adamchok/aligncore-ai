import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { embedText, cosineSimilarity, generateText } from '../lib/gemini'

export const matchRouter = Router()

interface CompanyProfile {
  name?: string
  industry?: string
  stage?: string
  challenge?: string
  mentor_expertise?: string
  size?: string
}

interface MentorDoc {
  id: string
  name: string
  expertise: string[]
  bio: string
  industries: string[]
}

interface RankedMentor extends MentorDoc {
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

    // ── Embed the company profile ────────────────────────────────────────
    const profileText = [
      company_profile.name,
      company_profile.industry,
      company_profile.stage,
      company_profile.challenge,
      company_profile.mentor_expertise,
    ]
      .filter(Boolean)
      .join('. ')

    const profileEmbedding = await embedText(profileText)

    // ── Fetch all mentors from Firestore ─────────────────────────────────
    const mentorsSnap = await adminDb.collection('mentors').get()
    const mentors = mentorsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MentorDoc))

    if (mentors.length === 0) {
      return res.json({ matches: [] })
    }

    // ── Embed each mentor & compute cosine similarity ────────────────────
    const scored = await Promise.all(
      mentors.map(async (mentor) => {
        const mentorText = [
          mentor.name,
          mentor.bio,
          ...(mentor.expertise ?? []),
          ...(mentor.industries ?? []),
        ].join('. ')

        const mentorEmbedding = await embedText(mentorText)
        const score = cosineSimilarity(profileEmbedding, mentorEmbedding)
        return { mentor, score }
      })
    )

    // Top 3 by cosine score
    const top3 = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ mentor, score }) => ({ mentor, score }))

    // ── Gemini re-ranking + reasoning ───────────────────────────────────
    const rerankPrompt = `
You are an expert startup mentor matching system for AlignCore AI.

Company Profile:
${JSON.stringify(company_profile, null, 2)}

Top 3 mentor candidates (pre-ranked by vector similarity):
${top3
  .map(
    ({ mentor, score }, i) =>
      `${i + 1}. ${mentor.name} (cosine: ${score.toFixed(3)})
   Expertise: ${(mentor.expertise ?? []).join(', ')}
   Industries: ${(mentor.industries ?? []).join(', ')}
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
      const clean = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      rankings = JSON.parse(clean)
    } catch {
      // Fallback: use cosine scores directly
      rankings = top3.map(({ mentor, score }, i) => ({
        id: mentor.id,
        rank: i + 1,
        ai_match_score: score,
        reasoning: 'Strong domain alignment based on semantic similarity.',
      }))
    }

    // Merge rankings with mentor data
    const matches: RankedMentor[] = rankings
      .map((r) => {
        const found = top3.find(({ mentor }) => mentor.id === r.id)
        if (!found) return null
        return {
          ...found.mentor,
          ai_match_score: r.ai_match_score,
          reasoning: r.reasoning,
          rank: r.rank,
        } as RankedMentor
      })
      .filter(Boolean) as RankedMentor[]

    return res.json({ matches })
  } catch (err) {
    console.error('[match] error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

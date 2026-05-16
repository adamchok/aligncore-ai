import { FunctionTool } from '@google/adk'
import { z } from 'zod'
import { adminDb } from '../firebase-admin'

interface MentorResult {
  id: string
  name: string
  bio: string
  expertise: string[]
  industry: string
  industries: string[]
  available: boolean
}

function sanitize(data: FirebaseFirestore.DocumentData): MentorResult {
  const { embedding: _drop, ...rest } = data
  return {
    id: rest.id ?? '',
    name: rest.name ?? '',
    bio: rest.bio ?? '',
    expertise: rest.expertise ?? [],
    industry: rest.industry ?? '',
    industries: rest.industries ?? [],
    available: rest.available ?? true,
  }
}

export const searchMentorsByIndustry = new FunctionTool({
  name: 'searchMentorsByIndustry',
  description: 'Search for available mentors whose industries include the given label.',
  parameters: z.object({
    industry: z.string().describe('Industry label, e.g. FinTech, SaaS, HealthTech'),
  }),
  execute: async ({ industry }) => {
    let snap = await adminDb
      .collection('mentors')
      .where('industries', 'array-contains', industry)
      .where('available', '==', true)
      .get()

    if (snap.empty) {
      snap = await adminDb
        .collection('mentors')
        .where('industry', '==', industry)
        .where('available', '==', true)
        .get()
    }

    const mentors = snap.docs.map(d => sanitize({ id: d.id, ...d.data() }))
    return { mentors }
  },
})

export const searchMentorsByExpertise = new FunctionTool({
  name: 'searchMentorsByExpertise',
  description: 'Search for available mentors who have a specific expertise tag.',
  parameters: z.object({
    expertise_tag: z.string().describe('A single expertise keyword, e.g. "fundraising", "product"'),
  }),
  execute: async ({ expertise_tag }) => {
    const snap = await adminDb
      .collection('mentors')
      .where('expertise', 'array-contains', expertise_tag)
      .where('available', '==', true)
      .get()

    const mentors = snap.docs.map(d => sanitize({ id: d.id, ...d.data() }))
    return { mentors }
  },
})

export const getAllAvailableMentors = new FunctionTool({
  name: 'getAllAvailableMentors',
  description: 'Fallback: list all mentors marked as available, up to 20.',
  parameters: z.object({}),
  execute: async () => {
    let snap = await adminDb
      .collection('mentors')
      .where('available', '==', true)
      .limit(20)
      .get()

    if (snap.empty) {
      snap = await adminDb.collection('mentors').limit(20).get()
    }

    const mentors = snap.docs.map(d => sanitize({ id: d.id, ...d.data() }))
    return { mentors }
  },
})

/**
 * Run once to seed Firestore with demo data.
 * Usage: pnpm seed
 */
import dotenv from 'dotenv'
dotenv.config()

import { getApp } from 'firebase-admin/app'
import { adminDb } from '../lib/firebase-admin'

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'

/** Shape aligned with doc/MVP_Development_Guide.md Part 0 + RelationshipCard */
const DEMO_RE = {
  relationship_id: DEMO_RE_ID,
  type: 'MENTOR_COMPANY',
  lifecycle_state: 'ACTIVE',
  company: {
    name: 'NexGen Robotics',
    industry: 'Deep Tech / Robotics',
    stage: 'SEED',
    founder: 'Sarah Tan',
    whatsapp: '+601112345678',
  },
  mentor: {
    name: 'Ahmad Farouk',
    expertise: ['Hardware', 'Manufacturing', 'Fundraising'],
  },
  ai_data: {
    match_score: 0.91,
    match_reasoning:
      'Hands-on robotics manufacturing and fundraising experience aligns with NexGen scaling hardware and raising Series A.',
    confidence_level: 'HIGH',
  },
  engagement: {
    health_score: 0.72,
    session_count: 4,
    avg_response_hours: 3.2,
  },
  comms: {
    last_sentiment: 'NEUTRAL' as const,
    last_message_text: 'Relationship initialized.',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const MENTORS = [
  {
    id: 'mentor-001',
    name: 'Dr. Aisha Rahman',
    bio: 'Serial entrepreneur with 15 years in FinTech and RegTech. Built and exited two payments startups. Expert in B2B SaaS monetization and financial compliance.',
    expertise: ['FinTech', 'RegTech', 'B2B SaaS', 'Product-Market Fit', 'Fundraising'],
    industries: ['Finance', 'Banking', 'Insurance'],
    industry: 'Finance',
    available: true,
    company_stage_fit: ['Pre-seed', 'Seed', 'Series A'],
  },
  {
    id: 'mentor-002',
    name: 'Marcus Tan',
    bio: 'Former VP Engineering at a unicorn edtech company. Specialist in scaling engineering teams from 5 to 100+, platform architecture, and developer productivity.',
    expertise: ['Engineering Leadership', 'EdTech', 'Platform Architecture', 'Team Scaling'],
    industries: ['Education', 'SaaS', 'Consumer'],
    industry: 'Education',
    available: true,
    company_stage_fit: ['Seed', 'Series A', 'Growth'],
  },
  {
    id: 'mentor-003',
    name: 'Priya Nair',
    bio: 'Growth marketing veteran with deep expertise in Southeast Asian markets. Helped 10+ startups achieve 10x growth through data-driven acquisition and retention strategies.',
    expertise: ['Growth Marketing', 'SEA Markets', 'User Acquisition', 'Data Analytics', 'GTM Strategy'],
    industries: ['E-commerce', 'HealthTech', 'Consumer Apps', 'Marketplace'],
    industry: 'E-commerce',
    available: true,
    company_stage_fit: ['Pre-seed', 'Seed', 'Series A'],
  },
  {
    id: 'mentor-004',
    name: 'Jonathan Lim',
    bio: 'M&A advisor and corporate strategist. 20 years experience leading digital transformation at Fortune 500 companies across manufacturing, logistics, and supply chain.',
    expertise: ['Digital Transformation', 'M&A', 'Enterprise Sales', 'Supply Chain', 'Operations'],
    industries: ['Manufacturing', 'Logistics', 'Enterprise', 'B2B'],
    industry: 'Manufacturing',
    available: true,
    company_stage_fit: ['Series A', 'Growth'],
  },
  {
    id: 'mentor-005',
    name: 'Dr. Siti Hajar',
    bio: 'HealthTech pioneer and medical doctor turned entrepreneur. Founded a telemedicine platform serving 2M+ patients in ASEAN. Expert in health regulation, clinical validation, and hospital partnerships.',
    expertise: ['HealthTech', 'Medical Devices', 'Regulatory Affairs', 'Clinical Validation', 'ASEAN Health'],
    industries: ['Healthcare', 'Telemedicine', 'BioTech', 'Wellness'],
    industry: 'Healthcare',
    available: true,
    company_stage_fit: ['Idea', 'Pre-seed', 'Seed'],
  },
]

async function seed() {
  console.log('🌱 Seeding Firestore...')
  const projectId = getApp('admin').options.projectId ?? '(unknown)'
  const dbId = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)'
  console.log(`   Project: ${projectId}`)
  console.log(`   Database: ${dbId}`)

  await adminDb.collection('relationships').doc(DEMO_RE_ID).set(DEMO_RE)
  console.log(`  ✅ relationships/${DEMO_RE_ID}`)

  for (const mentor of MENTORS) {
    const { id, ...data } = mentor
    await adminDb.collection('mentors').doc(id).set(data)
    console.log(`  ✅ mentors/${id} — ${mentor.name}`)
  }

  console.log('🎉 Seeding complete!')
  process.exit(0)
}

function isNotFound(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: number }).code === 5
  }
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('NOT_FOUND')
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  if (isNotFound(err)) {
    const projectId = getApp('admin').options.projectId ?? '(unknown)'
    console.error(`
Firestore returned NOT_FOUND — the SDK cannot find the Firestore database it is targeting (wrong/missing DB, or APIs off).

Checklist:
1) Firebase Console → Firestore Database — create one if missing (Native mode, pick a region).
2) If you use a **named** database (not "(default)"), set in .env: FIRESTORE_DATABASE_ID=aligncore-db (your console “Database ID”).
3) Google Cloud Console for the same project → enable "Cloud Firestore API" if needed.
4) GOOGLE_APPLICATION_CREDENTIALS JSON must belong to this project (project_id = "${projectId}").

If keys came from another GCP project, regenerate from Firebase Project settings → Service accounts.
`)
  }
  process.exit(1)
})

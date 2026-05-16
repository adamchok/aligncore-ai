/**
 * Run once to seed Firestore with demo data.
 * Usage: npm run seed
 */
import dotenv from 'dotenv'
dotenv.config()

import { adminDb } from '../lib/firebase-admin'

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'

const DEMO_RE = {
  id: DEMO_RE_ID,
  state: 'ACTIVE',
  company_id: 'company-001',
  mentor_id: 'mentor-001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  engagement: {
    health_score: 0.72,
    sessions_completed: 3,
    avg_response_time_hours: 4.2,
  },
  comms: {
    channel: 'whatsapp',
    last_sentiment: 'NEUTRAL',
    last_wa_at: new Date().toISOString(),
    last_message_preview: 'Relationship initialized.',
    gmail_thread_id: null,
  },
  ai_match_score: 0.91,
  reuse_template: false,
}

const MENTORS = [
  {
    id: 'mentor-001',
    name: 'Dr. Aisha Rahman',
    bio: 'Serial entrepreneur with 15 years in FinTech and RegTech. Built and exited two payments startups. Expert in B2B SaaS monetization and financial compliance.',
    expertise: ['FinTech', 'RegTech', 'B2B SaaS', 'Product-Market Fit', 'Fundraising'],
    industries: ['Finance', 'Banking', 'Insurance'],
    company_stage_fit: ['Pre-seed', 'Seed', 'Series A'],
  },
  {
    id: 'mentor-002',
    name: 'Marcus Tan',
    bio: 'Former VP Engineering at a unicorn edtech company. Specialist in scaling engineering teams from 5 to 100+, platform architecture, and developer productivity.',
    expertise: ['Engineering Leadership', 'EdTech', 'Platform Architecture', 'Team Scaling'],
    industries: ['Education', 'SaaS', 'Consumer'],
    company_stage_fit: ['Seed', 'Series A', 'Growth'],
  },
  {
    id: 'mentor-003',
    name: 'Priya Nair',
    bio: 'Growth marketing veteran with deep expertise in Southeast Asian markets. Helped 10+ startups achieve 10x growth through data-driven acquisition and retention strategies.',
    expertise: ['Growth Marketing', 'SEA Markets', 'User Acquisition', 'Data Analytics', 'GTM Strategy'],
    industries: ['E-commerce', 'HealthTech', 'Consumer Apps', 'Marketplace'],
    company_stage_fit: ['Pre-seed', 'Seed', 'Series A'],
  },
  {
    id: 'mentor-004',
    name: 'Jonathan Lim',
    bio: 'M&A advisor and corporate strategist. 20 years experience leading digital transformation at Fortune 500 companies across manufacturing, logistics, and supply chain.',
    expertise: ['Digital Transformation', 'M&A', 'Enterprise Sales', 'Supply Chain', 'Operations'],
    industries: ['Manufacturing', 'Logistics', 'Enterprise', 'B2B'],
    company_stage_fit: ['Series A', 'Growth'],
  },
  {
    id: 'mentor-005',
    name: 'Dr. Siti Hajar',
    bio: 'HealthTech pioneer and medical doctor turned entrepreneur. Founded a telemedicine platform serving 2M+ patients in ASEAN. Expert in health regulation, clinical validation, and hospital partnerships.',
    expertise: ['HealthTech', 'Medical Devices', 'Regulatory Affairs', 'Clinical Validation', 'ASEAN Health'],
    industries: ['Healthcare', 'Telemedicine', 'BioTech', 'Wellness'],
    company_stage_fit: ['Idea', 'Pre-seed', 'Seed'],
  },
]

async function seed() {
  console.log('🌱 Seeding Firestore...')

  // Seed the demo RE
  await adminDb.collection('relationships').doc(DEMO_RE_ID).set(DEMO_RE)
  console.log(`  ✅ relationships/${DEMO_RE_ID}`)

  // Seed mentors
  for (const mentor of MENTORS) {
    const { id, ...data } = mentor
    await adminDb.collection('mentors').doc(id).set(data)
    console.log(`  ✅ mentors/${id} — ${mentor.name}`)
  }

  console.log('🎉 Seeding complete!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})

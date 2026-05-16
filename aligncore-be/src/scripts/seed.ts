/**
 * Run once to seed Firestore with demo data.
 * Usage: pnpm seed
 */
import dotenv from 'dotenv'
dotenv.config()

import { getApp } from 'firebase-admin/app'
import { adminDb } from '../lib/firebase-admin'

const now = new Date().toISOString()

const COMPANIES = [
  {
    id: 'company-001',
    name: 'NexGen Robotics',
    industry: 'Deep Tech',
    stage: 'Seed',
    about:
      'Develops modular robotic arms and control software for small factories and warehouses that cannot afford legacy automation.',
    problem: 'Building affordable industrial robotics for SMEs in Southeast Asia.',
    goals: 'Raise Series A and expand to 3 new markets by end of year.',
    size: '12',
    created_at: now,
  },
  {
    id: 'company-002',
    name: 'MediTrack',
    industry: 'HealthTech',
    stage: 'Pre-seed',
    about:
      'Cloud-based clinic workflow platform focused on offline-first charts and inventory for rural healthcare providers.',
    problem: 'Digitizing patient records for rural clinics in Malaysia.',
    goals: 'Achieve product-market fit and onboard 50 clinics.',
    size: '5',
    created_at: now,
  },
  {
    id: 'company-003',
    name: 'FinFlow',
    industry: 'FinTech',
    stage: 'Seed',
    about:
      'B2B payments stack offering instant settlement APIs for SME marketplaces and distributors across Southeast Asia.',
    problem: 'Providing instant B2B payment solutions for SMEs across SEA.',
    goals: 'Get regulatory approval and grow to $1M ARR.',
    size: '8',
    created_at: now,
  },
]

const MENTORS = [
  {
    id: 'mentor-001',
    name: 'Dr. Aisha Rahman',
    bio: 'Serial entrepreneur with 15 years in FinTech and RegTech. Built and exited two payments startups. Expert in B2B SaaS monetization and financial compliance.',
    expertise: ['FinTech', 'RegTech', 'B2B SaaS', 'Product-Market Fit', 'Fundraising'],
    industries: ['Finance', 'Banking', 'Insurance'],
    industry: 'Finance',
    available: true,
    created_at: now,
  },
  {
    id: 'mentor-002',
    name: 'Marcus Tan',
    bio: 'Former VP Engineering at a unicorn edtech company. Specialist in scaling engineering teams from 5 to 100+, platform architecture, and developer productivity.',
    expertise: ['Engineering Leadership', 'EdTech', 'Platform Architecture', 'Team Scaling'],
    industries: ['Education', 'SaaS', 'Consumer'],
    industry: 'Education',
    available: true,
    created_at: now,
  },
  {
    id: 'mentor-003',
    name: 'Priya Nair',
    bio: 'Growth marketing veteran with deep expertise in Southeast Asian markets. Helped 10+ startups achieve 10x growth through data-driven acquisition and retention strategies.',
    expertise: ['Growth Marketing', 'SEA Markets', 'User Acquisition', 'Data Analytics', 'GTM Strategy'],
    industries: ['E-commerce', 'HealthTech', 'Consumer Apps', 'Marketplace'],
    industry: 'E-commerce',
    available: true,
    created_at: now,
  },
  {
    id: 'mentor-004',
    name: 'Jonathan Lim',
    bio: 'M&A advisor and corporate strategist. 20 years experience leading digital transformation at Fortune 500 companies across manufacturing, logistics, and supply chain.',
    expertise: ['Digital Transformation', 'M&A', 'Enterprise Sales', 'Supply Chain', 'Operations'],
    industries: ['Manufacturing', 'Logistics', 'Enterprise', 'B2B'],
    industry: 'Manufacturing',
    available: true,
    created_at: now,
  },
  {
    id: 'mentor-005',
    name: 'Dr. Siti Hajar',
    bio: 'HealthTech pioneer and medical doctor turned entrepreneur. Founded a telemedicine platform serving 2M+ patients in ASEAN. Expert in health regulation, clinical validation, and hospital partnerships.',
    expertise: ['HealthTech', 'Medical Devices', 'Regulatory Affairs', 'Clinical Validation', 'ASEAN Health'],
    industries: ['Healthcare', 'Telemedicine', 'BioTech', 'Wellness'],
    industry: 'Healthcare',
    available: true,
    created_at: now,
  },
]

async function seed() {
  console.log('Seeding Firestore...')
  const projectId = getApp('admin').options.projectId ?? '(unknown)'
  const dbId = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)'
  console.log(`   Project: ${projectId}`)
  console.log(`   Database: ${dbId}`)
  console.log('  (Relationships are created in the app; seed only loads mentors/companies.)')

  // Companies
  for (const company of COMPANIES) {
    const { id, ...data } = company
    await adminDb.collection('companies').doc(id).set(data)
    console.log(`  OK companies/${id} — ${company.name}`)
  }

  // Mentors
  for (const mentor of MENTORS) {
    const { id, ...data } = mentor
    await adminDb.collection('mentors').doc(id).set(data)
    console.log(`  OK mentors/${id} — ${mentor.name}`)
  }

  console.log('Seeding complete!')
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
  console.error('Seed failed:', err)
  if (isNotFound(err)) {
    const projectId = getApp('admin').options.projectId ?? '(unknown)'
    console.error(`
Firestore returned NOT_FOUND — the SDK cannot find the Firestore database it is targeting.

Checklist:
1) Firebase Console → Firestore Database — create one if missing (Native mode, pick a region).
2) If you use a named database (not "(default)"), set: FIRESTORE_DATABASE_ID=aligncore-db
3) Google Cloud Console → enable "Cloud Firestore API" if needed.
4) GOOGLE_APPLICATION_CREDENTIALS JSON must belong to project: ${projectId}
`)
  }
  process.exit(1)
})

/**
 * Seed Firestore with demo **companies** only (no mentors).
 * Usage: pnpm seed
 */
import dotenv from 'dotenv'
dotenv.config()

import { getApp } from 'firebase-admin/app'
import { adminDb } from '../lib/firebase-admin'

const now = new Date().toISOString()

/** Matches FE/API industry whitelist where possible */
type SeedCompany = {
  id: string
  name: string
  industry: string
  stage: string
  about: string
  problem: string
  goals: string
  size: string
  whatsapp_number: string
  photo_url: string
  knowledge_doc_count: number
  created_at: string
}

const COMPANIES: SeedCompany[] = [
  {
    id: 'company-001',
    name: 'NexGen Robotics',
    industry: 'DeepTech',
    stage: 'Seed',
    about:
      'Builds modular cobots and browser-based fleet orchestration for tier-2 factories (electronics assembly, packaging). Ships hardware-lite bundles so SMEs avoid seven-figure capex.',
    problem:
      'Legacy automation vendors underserve SMEs in Southeast Asia—long installs, opaque pricing, and no local service footprint.',
    goals:
      'Close a strategic distributor in Vietnam, publish repeatable deployment playbook, and prep Series A materials.',
    size: '12',
    whatsapp_number: '60192001101',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-002',
    name: 'MediTrack Clinic Cloud',
    industry: 'HealthTech',
    stage: 'Pre-seed',
    about:
      'Offline-first EMR plus inventory for rural clinics; nurse-centric workflows, Bahasa-first UX, sync when connectivity returns.',
    problem:
      'Paper charts and fragmented stock-outs delay care and block insurer reporting for clinics outside major cities.',
    goals:
      'Pilot with 15 clinics, validate referral loop with two PHOs, and secure MOH-adjacent pilot letter.',
    size: '5',
    whatsapp_number: '60192001102',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-003',
    name: 'FinFlow Payments',
    industry: 'FinTech',
    stage: 'Seed',
    about:
      'Instant B2B payouts API for distributors and vertical SaaS—KYB-assisted onboarding, sandbox in hours, rails-aware routing.',
    problem:
      'SME supply chains still run on delayed invoices and manual reconciliation across fragmented bank portals.',
    goals:
      'Obtain sandbox regulatory clarity, ship ledger reconciliation v2, reach $500k monthly TPV.',
    size: '18',
    whatsapp_number: '60192001103',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-004',
    name: 'LearnLoop',
    industry: 'EdTech',
    stage: 'Series A',
    about:
      'Adaptive math practice for national curricula—teacher dashboards, printable remediation packs, low-bandwidth mobile web.',
    problem:
      'Classrooms lack timely diagnostic data; generic apps ignore syllabus pacing and national exam formats.',
    goals:
      'Expand to two new states, lift weekly active classrooms by 40%, tighten unit economics per school.',
    size: '34',
    whatsapp_number: '60192001104',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-005',
    name: 'KopiCart',
    industry: 'E-Commerce',
    stage: 'Seed',
    about:
      'Operator toolkit for specialty coffee chains—centralised bean costing, outlet-level forecasting, WhatsApp preorder hooks.',
    problem:
      'Multi-outlet brands leak margin on wastage and inconsistent procurement with no unified demand signal.',
    goals:
      'Onboard 25 outlets, integrate two regional roasters, prove 8% COGS improvement in cohort.',
    size: '9',
    whatsapp_number: '60192001105',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-006',
    name: 'GridPulse Energy',
    industry: 'CleanTech',
    stage: 'Series B',
    about:
      'Hardware-light analytics for commercial solar + storage portfolios—forecasting exports, tariff optimisation alerts.',
    problem:
      'Asset owners struggle to translate inverter telemetry into actionable revenue and maintenance decisions.',
    goals:
      'Standardise enterprise SLA playbook, reduce churn under 4%, prepare APAC expansion ops hire.',
    size: '62',
    whatsapp_number: '60192001106',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-007',
    name: 'HarborOps',
    industry: 'SaaS',
    stage: 'Growth',
    about:
      'Workflow OS for mid-sized freight forwarders—booking intake, customs doc packs, exception queues with SLA timers.',
    problem:
      'Email-and-spreadsheet forwarding chains cause missed cutoff windows and opaque customer status.',
    goals:
      'Land three lighthouse accounts in SG/MY corridor, ship customs connector roadmap v1.',
    size: '48',
    whatsapp_number: '60192001107',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-008',
    name: 'TalentNest HR',
    industry: 'SaaS',
    stage: 'Seed',
    about:
      'People ops suite for 80–800 employee employers—leave policy designer, payroll hand-off APIs, lightweight engagement pulses.',
    problem:
      'Growing SMEs outgrow spreadsheets before they can justify enterprise HCM contracts.',
    goals:
      'Reach 120 paying organisations, tighten onboarding time-to-value under two weeks.',
    size: '14',
    whatsapp_number: '60192001108',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-009',
    name: 'BioSense Dx',
    industry: 'HealthTech',
    stage: 'Series A',
    about:
      'Point-of-care assay reader paired with cloud QA—focused on tropical infectious panels for clinics without lab capacity.',
    problem:
      'Turnaround times for referral labs squeeze rural triage; clinicians need guideline-aligned interpretations.',
    goals:
      'Complete usability trials at partner hospitals, file regulatory dossier milestone two.',
    size: '27',
    whatsapp_number: '60192001109',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-010',
    name: 'PlotWise Analytics',
    industry: 'Other',
    stage: 'Pre-seed',
    about:
      'Vertical GIS analytics for township developers—earthworks estimation from drone orthophotos, compliance overlays.',
    problem:
      'Manual quantity surveying slows bids and hides variance until earthworks contractors mobilise.',
    goals:
      'Convert two paid pilots, catalogue reusable terrain templates per region.',
    size: '6',
    whatsapp_number: '60192001110',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-011',
    name: 'ShieldVault Cyber',
    industry: 'SaaS',
    stage: 'Series A',
    about:
      'Continuous controls monitoring for regulated SMEs—agentless connectors for identity, SaaS sprawl, and vendor attestations.',
    problem:
      'Mid-market teams lack staffed SOC programmes but face rising auditor expectations.',
    goals:
      'Expand MSSP partner channel, publish SOC2-aligned blueprint templates.',
    size: '31',
    whatsapp_number: '60192001111',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
  {
    id: 'company-012',
    name: 'FreshLane Foods',
    industry: 'E-Commerce',
    stage: 'Late Stage',
    about:
      'Cold-chain marketplace linking kitchens with audited suppliers—dynamic shelf-life routing and recall orchestration.',
    problem:
      'Fragmented supplier quality and opaque cold-chain hand-offs drive spoilage and brand risk.',
    goals:
      'Optimise hub economics in flagship city, deepen retailer private-label partnerships.',
    size: '140',
    whatsapp_number: '60192001112',
    photo_url: '',
    knowledge_doc_count: 0,
    created_at: now,
  },
]

async function seed() {
  console.log('Seeding Firestore (companies only)...')
  const projectId = getApp('admin').options.projectId ?? '(unknown)'
  const dbId = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)'
  console.log(`   Project: ${projectId}`)
  console.log(`   Database: ${dbId}`)

  for (const company of COMPANIES) {
    const { id, ...data } = company
    await adminDb.collection('companies').doc(id).set(data)
    console.log(`  OK companies/${id} — ${company.name}`)
  }

  console.log(`Seeding complete — ${COMPANIES.length} companies.`)
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

# AlignCore AI — MVP Development Guide

> **Hackathon: Build With AI 2026 KL — MyHack**
> **Submission deadline: 17 May 2026, 09:00 AM**
> **Target scope: Small Tier only — four connected flows**

---

## Overview

This guide is written for **two developers working in parallel** with zero merge conflicts. The repository is split into two completely independent directories:

```
aligncore-ai/
├── aligncore-be/    ← BE developer's domain (Express, TypeScript, pnpm)
├── aligncore-fe/    ← FE developer's domain (Next.js 16, React 19, TypeScript, Tailwind 4)
└── doc/             ← This guide
```

**The only coordination needed** is agreeing on the API contract below, then each dev works independently until integration in Hours 21–22.

---

## Four Demo Flows (in priority order)

| Priority | Flow | Visual Moment |
|---|---|---|
| 1 | Firebase Dashboard with live Health Score | RE card updates in real time |
| 2 | WAHA WhatsApp webhook → Health Score | Phone sends message → dashboard animates |
| 3 | AI Mentor Matching (Vertex AI + Gemini) | Top-3 matches appear with reasoning |
| 4 | Gemini Conversational Onboarding | Chat fills RE profile automatically |

> **Rule:** BE dev owns Flows 2, 3, 4 (all AI/webhook logic). FE dev owns Flows 1, 3 UI, 4 UI. Flow 1 (live dashboard) is FE-only via Firebase client SDK and can be demoed before the BE is connected at all.

---

## Part 0 — Shared Setup (Both Devs Read This First)

### 0.1 API Contract

This is the **single source of truth** agreed upfront. BE builds to this spec. FE calls this spec. No surprises at integration time.

#### `POST /api/waha/webhook`
Called by WAHA automatically. FE never calls this.

#### `POST /api/match`
```
Request:  { company_profile: { name, industry, stage, problem, goals } }
Response: { matches: [{ id, name, industry, expertise[], bio, ai_match_score, reasoning, rank }] }
```

#### `POST /api/chat`
```
Request:  { messages: [{ role: "user"|"model", text: string }], session_id: string }
Response: { reply: string, profile_extracted: object|null, is_complete: boolean }
```

#### `GET /api/demo/simulate-positive`
```
Response: { ok: true, sentiment: "POSITIVE", health_score: 0.87 }
```

#### `GET /api/demo/simulate-negative`
```
Response: { ok: true, sentiment: "NEGATIVE", health_score: 0.31 }
```

#### `GET /api/health`
```
Response: { ok: true, uptime: number }
```

### 0.2 Firebase Collections

Both devs need to know the Firestore document shape.

**`relationships/demo-re-001`**
```json
{
  "relationship_id": "demo-re-001",
  "type": "MENTOR_COMPANY",
  "lifecycle_state": "ACTIVE",
  "company": { "name": "NexGen Robotics", "industry": "Deep Tech / Robotics", "stage": "SEED", "founder": "Sarah Tan", "whatsapp": "+601112345678" },
  "mentor": { "name": "Ahmad Farouk", "expertise": ["Hardware", "Manufacturing", "Fundraising"] },
  "ai_data": { "match_score": 0.91, "match_reasoning": "...", "confidence_level": "HIGH" },
  "engagement": { "health_score": 0.72, "session_count": 4, "avg_response_hours": 3.2 },
  "comms": { "last_sentiment": null, "last_message_text": null }
}
```

**`mentors/{id}`** — 5 documents, each with `{ name, industry, expertise[], bio, available: true }`

### 0.3 Google Cloud Prerequisites (Both Devs Confirm)

- [ ] GCP project created with billing enabled
- [ ] Firebase project linked to GCP project
- [ ] Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- [ ] Vertex AI API enabled (`vertexai.googleapis.com`)
- [ ] Firebase Admin SDK service account JSON downloaded
- [ ] Docker installed (BE dev only, for WAHA)

---

## Part 1 — BE Developer Guide

**Your domain:** `aligncore-be/`
**Your job:** All API routes, AI logic, WAHA webhook, Firebase Admin writes.
**You never touch:** `aligncore-fe/`

### BE Step 0: Project Setup (Hour 1)

```bash
cd aligncore-be

# Init project
pnpm init --bare --init-package-manager
pnpm add express cors dotenv firebase-admin @google/genai
pnpm add -D typescript ts-node ts-node-dev @types/node @types/express @types/cors

# Init TypeScript
pnpm exec tsc --init
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Create `package.json` scripts:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed": "ts-node src/scripts/seed.ts"
  }
}
```

Create `.env` in `aligncore-be/` (copy from `.env.example`):
```bash
PORT=4000

# CORS — browser origin for aligncore-fe
FE_ORIGIN=http://localhost:3001

# Firebase Admin SDK — recommended approach (service account JSON file)
# 1. mkdir aligncore-be/credentials   (gitignored)
# 2. Firebase Console → Project settings → Service accounts → Generate new private key
# 3. Save as: aligncore-be/credentials/firebase-service-account.json
GOOGLE_APPLICATION_CREDENTIALS=./credentials/firebase-service-account.json
# If you use a named Firestore DB (not "(default)"), set its Database ID here:
FIRESTORE_DATABASE_ID=aligncore-db

# Fallback inline creds (comment out the two lines above if using these)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# WAHA
WAHA_URL=http://localhost:3000
WAHA_SESSION=aligncore-demo

# Demo
DEMO_RE_ID=demo-re-001
```

> **Note:** `.env` must be in `.gitignore`. Never commit secrets.

Add `.gitignore`:
```
node_modules/
dist/
.env
*.js.map
credentials/
```

### BE Step 1: Express Server Entry Point (Hour 1)

Create `src/index.ts`:

```typescript
// aligncore-be/src/index.ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import { wahaRouter } from './routes/waha'
import { matchRouter } from './routes/match'
import { chatRouter } from './routes/chat'
import { demoRouter } from './routes/demo'

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors({ origin: process.env.FE_ORIGIN ?? '*' }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

// Routes
app.use('/api/waha', wahaRouter)
app.use('/api/match', matchRouter)
app.use('/api/chat', chatRouter)
app.use('/api/demo', demoRouter)

app.listen(PORT, () => {
  console.log(`AlignCore BE running on http://localhost:${PORT}`)
})
```

### BE Step 2: Firebase Admin Singleton (Hour 1)

Create `src/lib/firebase-admin.ts`:

```typescript
// aligncore-be/src/lib/firebase-admin.ts
import fs from 'fs'
import path from 'path'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function resolveGoogleApplicationCredentials(): void {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!gac) return
  const abs = path.isAbsolute(gac) ? gac : path.resolve(process.cwd(), gac)
  if (!fs.existsSync(abs)) {
    throw new Error(`[firebase-admin] GOOGLE_APPLICATION_CREDENTIALS not found:\n  ${abs}`)
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = abs
}

resolveGoogleApplicationCredentials()

const hasJsonFile = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim())

function credential() {
  if (hasJsonFile) return applicationDefault()
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  })
}

function resolvedProjectId(): string | undefined {
  if (hasJsonFile) {
    try {
      const j = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8'))
      return j.project_id?.trim()
    } catch { return undefined }
  }
  return process.env.FIREBASE_PROJECT_ID?.trim()
}

const adminApp =
  getApps().find((a) => a.name === 'admin') ??
  initializeApp({ credential: credential(), projectId: resolvedProjectId() }, 'admin')

const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)'

export const adminDb = getFirestore(adminApp, firestoreDatabaseId)
```

Also create `src/lib/gemini.ts` — a shared Gemini client used by all routes:

```typescript
// aligncore-be/src/lib/gemini.ts
import { GoogleGenAI } from '@google/genai'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment')
}

export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export const MODELS = {
  flash: 'gemini-2.0-flash',
  embedding: 'text-embedding-004',
} as const

export async function generateText(prompt: string): Promise<string> {
  const result = await genai.models.generateContent({
    model: MODELS.flash,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  return result.text ?? ''
}

export async function embedText(text: string): Promise<number[]> {
  const result = await genai.models.embedContent({
    model: MODELS.embedding,
    contents: [{ role: 'user', parts: [{ text }] }],
  })
  return result.embeddings?.[0]?.values ?? []
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] ** 2; magB += b[i] ** 2
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
```

### BE Step 3: Seed Script (Hour 1–2)

Create `src/scripts/seed.ts` and run it **once** to populate Firestore:

```typescript
// aligncore-be/src/scripts/seed.ts
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import dotenv from 'dotenv'
dotenv.config()

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  }),
})
const db = getFirestore(app)

async function seed() {
  // Demo Relationship Entity
  await db.collection('relationships').doc('demo-re-001').set({
    relationship_id: 'demo-re-001',
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
      linkedin: 'linkedin.com/in/ahmadfarouk',
    },
    ai_data: {
      match_score: 0.91,
      match_reasoning:
        "Ahmad has direct experience scaling hardware startups from seed to Series A in Southeast Asia, directly complementing NexGen Robotics' manufacturing challenges.",
      confidence_level: 'HIGH',
    },
    engagement: {
      health_score: 0.72, // ← this is what the live demo updates
      last_message_at: Timestamp.now(),
      avg_response_hours: 3.2,
      session_count: 4,
    },
    comms: {
      whatsapp_thread_id: null,
      last_sentiment: null,
      last_message_text: null,
    },
    programme_contexts: ['cradle-accelerator-2026'],
    reuse_template: false,
    version: 1,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  })

  // Mentor pool
  const mentors = [
    {
      id: 'mentor-001',
      name: 'Ahmad Farouk',
      expertise: ['Hardware', 'Manufacturing', 'Fundraising', 'Series A'],
      industry: 'Deep Tech',
      bio: 'Former VP Engineering at Seagate Malaysia. Scaled two hardware startups from seed to Series A in SEA. Expert in contract manufacturing and investor relations.',
      available: true,
    },
    {
      id: 'mentor-002',
      name: 'Priya Nadarajan',
      expertise: ['SaaS', 'B2B Sales', 'Product-Market Fit', 'Enterprise'],
      industry: 'SaaS / Enterprise Software',
      bio: 'Co-founder of 3 SaaS companies. Sold enterprise software to Fortune 500s across APAC. Expert in outbound sales motion and pricing strategy.',
      available: true,
    },
    {
      id: 'mentor-003',
      name: 'David Lim',
      expertise: ['FinTech', 'Regulatory Compliance', 'Digital Banking', 'BNM'],
      industry: 'Financial Services',
      bio: 'Ex-BNM regulator. Helped 12 fintech startups navigate Malaysian financial regulations and secure MSB licences. Strong network in Labuan IBFC.',
      available: true,
    },
    {
      id: 'mentor-004',
      name: 'Rina Azman',
      expertise: ['AgriTech', 'IoT', 'Rural Market Entry', 'Government Grants'],
      industry: 'AgriTech / IoT',
      bio: 'Built and exited an IoT precision agriculture startup. Deep expertise in government grant applications (MARDI, MOA) and rural market distribution.',
      available: true,
    },
    {
      id: 'mentor-005',
      name: 'Chen Wei Liang',
      expertise: ['AI/ML', 'Computer Vision', 'Healthcare AI', 'Clinical Trials'],
      industry: 'HealthTech / AI',
      bio: 'PhD in Computer Vision from NUS. Led AI product at a MedTech unicorn. Expert in FDA/MDA regulatory pathways for AI medical devices.',
      available: true,
    },
  ]

  for (const { id, ...mentor } of mentors) {
    await db.collection('mentors').doc(id).set({ id, ...mentor, created_at: Timestamp.now() })
  }

  console.log('✅ Seed complete — 1 RE + 5 mentors written to Firestore')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
```

Run the seed:
```bash
cd aligncore-be
pnpm seed
```

### BE Step 4: WAHA Webhook Route (Hours 2–6)

This is the most important BE route — it receives WhatsApp messages, runs Gemini sentiment analysis, and writes back to Firestore. The FE dashboard picks up the change instantly via its Firestore listener.

Create `src/routes/waha.ts`:

```typescript
// aligncore-be/src/routes/waha.ts
import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { generateText } from '../lib/gemini'

export const wahaRouter = Router()

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'

wahaRouter.post('/webhook', async (req, res) => {
  try {
    const body = req.body

    if (body.event !== 'message') {
      return res.json({ ok: true, skipped: true })
    }

    const messageText: string = body.payload?.body ?? ''
    const fromNumber: string = body.payload?.from ?? ''

    if (!messageText.trim()) {
      return res.json({ ok: true, skipped: 'empty message' })
    }

    if (fromNumber) console.log(`[waha] inbound from ${fromNumber}`)

    const sentimentPrompt = `
Analyze the sentiment of this WhatsApp message from a mentee about their mentor relationship.
Reply with JSON only, no markdown:
{"sentiment":"POSITIVE"|"NEGATIVE"|"NEUTRAL","health_score_delta":<-0.25 to 0.25>}

Rules:
- POSITIVE: progress, engaged, excited → delta 0.05–0.20
- NEGATIVE: missed sessions, disengaged → delta -0.05 to -0.25
- NEUTRAL: generic update → delta -0.04 to 0.04

Message: "${messageText.replace(/"/g, "'")}"`.trim()

    const raw = await generateText(sentimentPrompt)
    let sentiment = 'NEUTRAL', delta = 0

    try {
      const parsed = JSON.parse(raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim())
      sentiment = parsed.sentiment ?? 'NEUTRAL'
      delta = parsed.health_score_delta ?? 0
    } catch {
      console.warn('[waha] Failed to parse Gemini sentiment response, defaulting to NEUTRAL')
    }

    const reRef = adminDb.collection('relationships').doc(DEMO_RE_ID)
    const snap = await reRef.get()

    if (!snap.exists) {
      console.warn('[waha] Relationship doc missing:', DEMO_RE_ID)
      return res.status(404).json({ ok: false, error: 'RE not found' })
    }

    const currentHealth: number = snap.data()?.engagement?.health_score ?? 0.5
    const newHealth = Math.min(1, Math.max(0, currentHealth + delta))
    const textField = messageText.length <= 200 ? messageText : `${messageText.slice(0, 197)}...`

    await reRef.update({
      'comms.last_sentiment': sentiment,
      'comms.last_message_text': textField,
      'comms.last_wa_at': new Date().toISOString(),
      'engagement.health_score': newHealth,
      updated_at: new Date().toISOString(),
    })

    return res.json({ ok: true, sentiment, health_score_before: currentHealth, health_score_after: newHealth, delta })
  } catch (err) {
    console.error('[WAHA Webhook Error]', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
})
```

### BE Step 5: Demo Simulation Routes (Hours 2–3, build in parallel with FE)

These routes let the FE dev test the live dashboard before WAHA is connected. Build these first so FE can work independently.

Create `src/routes/demo.ts`:

```typescript
// aligncore-be/src/routes/demo.ts
import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'

export const demoRouter = Router()

const DEMO_RE_ID = process.env.DEMO_RE_ID ?? 'demo-re-001'
const RE_REF = () => adminDb.collection('relationships').doc(DEMO_RE_ID)

async function updateRE(sentiment: string, healthScore: number, lastMessage: string): Promise<void> {
  await RE_REF().update({
    'comms.last_sentiment': sentiment,
    'engagement.health_score': healthScore,
    'comms.last_message_text': lastMessage,
    updated_at: new Date().toISOString(),
  })
}

demoRouter.get('/simulate-positive', async (_req, res) => {
  try {
    await updateRE('POSITIVE', 0.87, 'Had a great session with Ahmad today! We mapped out our Series A fundraising strategy for the next 6 months.')
    res.json({ ok: true, sentiment: 'POSITIVE', health_score: 0.87 })
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }) }
})

demoRouter.get('/simulate-negative', async (_req, res) => {
  try {
    await updateRE('NEGATIVE', 0.31, 'Sorry, we missed our last two sessions. Things are a bit hectic right now.')
    res.json({ ok: true, sentiment: 'NEGATIVE', health_score: 0.31 })
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }) }
})

demoRouter.get('/reset', async (_req, res) => {
  try {
    await RE_REF().update({
      'comms.last_sentiment': null,
      'comms.last_message_text': null,
      'engagement.health_score': 0.72,
      updated_at: new Date().toISOString(),
    })
    res.json({ ok: true, reset: true, health_score: 0.72 })
  } catch (err) { res.status(500).json({ ok: false, error: String(err) }) }
})
```

### BE Step 6: Mentor Matching Route (Hours 6–13)

Create `src/routes/match.ts`:

```typescript
// aligncore-be/src/routes/match.ts
import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { genai, MODELS, embedText, cosineSimilarity } from '../lib/gemini'

export const matchRouter = Router()

matchRouter.post('/', async (req, res) => {
  try {
    const { company_profile } = req.body as { company_profile: Record<string, string> }

    if (!company_profile?.name?.trim()) {
      return res.status(400).json({ error: 'company_profile.name is required' })
    }

    const profileText = [
      company_profile.name,
      company_profile.industry,
      company_profile.stage,
      company_profile.problem,
      company_profile.goals,
    ].filter(Boolean).join('. ')

    const profileEmbedding = await embedText(profileText)

    let mentorsSnap = await adminDb.collection('mentors').where('available', '==', true).get()
    if (mentorsSnap.empty) mentorsSnap = await adminDb.collection('mentors').get()

    const mentors = mentorsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
    if (mentors.length === 0) return res.json({ matches: [] })

    const scored = await Promise.all(
      mentors.map(async (mentor: any) => {
        const mentorText = [mentor.name, mentor.industry, mentor.bio, ...(mentor.expertise ?? [])].filter(Boolean).join('. ')
        const score = cosineSimilarity(profileEmbedding, await embedText(mentorText))
        return { mentor, score }
      })
    )

    const top3 = scored.sort((a, b) => b.score - a.score).slice(0, 3)

    const rerankPrompt = `You are an expert startup mentor matching system.

Company: ${profileText}

Top 3 mentor candidates:
${top3.map(({ mentor, score }, i) => `${i + 1}. ${mentor.name} (${mentor.industry ?? ''}) cosine=${score.toFixed(3)}\n   id: ${mentor.id}\n   Expertise: ${(mentor.expertise ?? []).join(', ')}\n   Bio: ${mentor.bio}`).join('\n\n')}

Reply with JSON only (no markdown):
[{"id":"...","rank":1,"ai_match_score":0.0-1.0,"reasoning":"2 sentences why this mentor fits this company"},...]`

    const raw = await genai.models.generateContent({ model: MODELS.flash, contents: [{ role: 'user', parts: [{ text: rerankPrompt }] }] }).then(r => r.text ?? '[]')

    let rankings: any[] = []
    try {
      rankings = JSON.parse(raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim())
    } catch {
      rankings = top3.map(({ mentor, score }, i) => ({ id: mentor.id, rank: i + 1, ai_match_score: score, reasoning: 'Strong domain expertise alignment.' }))
    }

    const matches = rankings.map((r) => {
      const found = top3.find(({ mentor }) => mentor.id === r.id)
      if (!found) return null
      const m = found.mentor
      return { id: m.id, name: m.name, industry: m.industry ?? '', expertise: m.expertise ?? [], bio: m.bio, ai_match_score: r.ai_match_score, reasoning: r.reasoning, rank: r.rank }
    }).filter(Boolean)

    matches.sort((a: any, b: any) => a.rank - b.rank)

    return res.json({ matches })
  } catch (err) {
    console.error('[Match Error]', err)
    return res.status(500).json({ error: String(err) })
  }
})
```

### BE Step 7: Chat / Onboarding Route (Hours 13–18)

Create `src/routes/chat.ts`:

```typescript
// aligncore-be/src/routes/chat.ts
import { Router } from 'express'
import { adminDb } from '../lib/firebase-admin'
import { genai, MODELS } from '../lib/gemini'

export const chatRouter = Router()

const SYSTEM_PROMPT = `You are AlignCore AI's onboarding assistant. Collect a company profile through friendly chat — not a form.

Collect these 6 fields naturally, one at a time:
1. name — company name
2. industry — sector (e.g. FinTech, Deep Tech, HealthTech, SaaS)
3. stage — Idea / Pre-seed / Seed / Series A / Growth
4. problem — main challenge or problem they're solving
5. goals — what they want from mentorship
6. whatsapp — founder's WhatsApp number (for check-ins)

Rules:
- Be warm and concise. Ask one question at a time.
- If the user volunteers several fields, acknowledge all and continue.
- Only when all 6 are confirmed, output this exact tagged block once (no prose inside the tags):
  <PROFILE>{"name":"...","industry":"...","stage":"...","problem":"...","goals":"...","whatsapp":"..."}</PROFILE>
- After the closing tag in the same reply, thank them briefly and mention they can use Match to find top mentors.

Before completion: conversational text only; never output PROFILE or partial JSON outside the tags.`

interface IncomingMessage {
  role: 'user' | 'model'
  parts?: Array<{ text: string }>
  text?: string  // API contract shape: { role, text }
}

function toGeminiParts(m: IncomingMessage): Array<{ text: string }> {
  if (m.parts?.length) return m.parts
  if (typeof m.text === 'string' && m.text.length > 0) return [{ text: m.text }]
  return []
}

chatRouter.post('/', async (req, res) => {
  try {
    const { messages, session_id } = req.body as {
      messages: IncomingMessage[]
      session_id: string
    }

    if (!messages?.length || !session_id) {
      return res.status(400).json({ error: 'messages (non-empty) and session_id are required' })
    }

    const contents = messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: toGeminiParts(m),
    }))

    const result = await genai.models.generateContent({
      model: MODELS.flash,
      contents,
      config: { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } },
    })

    const replyRaw = result.text ?? ''
    const profileMatch = replyRaw.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
    let profileExtracted: Record<string, string> | null = null
    let isComplete = false

    if (profileMatch) {
      try {
        profileExtracted = JSON.parse(profileMatch[1].trim()) as Record<string, string>
        isComplete = true
        await adminDb.collection('onboarding_sessions').doc(session_id).set({
          ...profileExtracted,
          session_id,
          completed_at: new Date().toISOString(),
        })
      } catch {
        console.warn('[chat] Failed to parse PROFILE JSON')
      }
    }

    return res.json({
      reply: replyRaw.replace(/<PROFILE>[\s\S]*?<\/PROFILE>\s*/, '').trim(),
      profile_extracted: profileExtracted,
      is_complete: isComplete,
    })
  } catch (err) {
    console.error('[Chat Error]', err)
    return res.status(500).json({ error: String(err) })
  }
})
```

### BE Step 8: Start and Test (Hour 2 onward, run continuously)

```bash
cd aligncore-be
pnpm dev
# Server running on http://localhost:4000

# Verify health
curl http://localhost:4000/api/health

# Test demo simulation (share this with FE dev right away)
curl http://localhost:4000/api/demo/simulate-positive
curl http://localhost:4000/api/demo/simulate-negative
curl http://localhost:4000/api/demo/reset

# Test match endpoint
curl -X POST http://localhost:4000/api/match \
  -H "Content-Type: application/json" \
  -d '{"company_profile":{"name":"NexGen Robotics","industry":"Deep Tech","stage":"SEED","problem":"Hardware manufacturing scale-up","goals":"Series A fundraising and contract manufacturing guidance"}}'

# Test chat endpoint
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","text":"Hi, my company is NexGen Robotics and we build inspection robots."}],"session_id":"test-001"}'

# Simulate a WAHA webhook manually
curl -X POST http://localhost:4000/api/waha/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"message","session":"aligncore-demo","payload":{"body":"Had a great session today! We finalised the manufacturing roadmap.","from":"601112345678@c.us"}}'
```

### BE Step 9: WAHA Setup (Hours 5–9, run alongside route development)

```bash
# Pull and start WAHA (separate terminal)
docker run -it --rm \
  -p 3000:3000 \
  -e WHATSAPP_HOOK_EVENTS=message \
  -e WAHA_API_KEY=your_waha_api_key \
  devlikeapro/waha

# Create and start a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_waha_api_key" \
  -d '{"name":"aligncore-demo","config":{"webhooks":[{"url":"http://host.docker.internal:4000/api/waha/webhook","events":["message"]}]}}'

curl -X POST http://localhost:3000/api/sessions/aligncore-demo/start \
  -H "X-Api-Key: your_waha_api_key"

# Get QR code (base64 PNG) — open in browser or decode to scan
curl http://localhost:3000/api/sessions/aligncore-demo/auth/qr \
  -H "X-Api-Key: your_waha_api_key"
```

Scan the QR with the demo phone (your personal WhatsApp or a dedicated number). Session is now live.

### BE Step 10: Deploy to Cloud Run (Hour 18–20)

Create `Dockerfile` in `aligncore-be/`:

```dockerfile
FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY dist/ ./dist/
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

> **Note:** The Dockerfile only copies `dist/` — run `pnpm build` locally first, then deploy.

```bash
# Build locally, then deploy
pnpm build

# Deploy BE — use Secret Manager for GOOGLE_APPLICATION_CREDENTIALS in prod
gcloud run deploy aligncore-be \
  --source . \
  --region asia-southeast1 \
  --port 4000 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=...,FIRESTORE_DATABASE_ID=aligncore-db,DEMO_RE_ID=demo-re-001"
  # Mount service account JSON via Secret Manager or use Workload Identity instead of GOOGLE_APPLICATION_CREDENTIALS

# Deploy WAHA
docker pull devlikeapro/waha
docker tag devlikeapro/waha asia-southeast1-docker.pkg.dev/YOUR_PROJECT/aligncore/waha:latest
docker push asia-southeast1-docker.pkg.dev/YOUR_PROJECT/aligncore/waha:latest

gcloud run deploy aligncore-waha \
  --image asia-southeast1-docker.pkg.dev/YOUR_PROJECT/aligncore/waha:latest \
  --region asia-southeast1 \
  --port 3000 \
  --min-instances 1 \
  --memory 512Mi \
  --allow-unauthenticated \
  --set-env-vars "WAHA_API_KEY=your_waha_api_key"
```

After deploying, update the WAHA session webhook URL to point to the Cloud Run BE URL, then re-scan the QR.

---

## Part 2 — FE Developer Guide

**Your domain:** `aligncore-fe/`
**Your job:** All pages, components, Tailwind styling, Firebase real-time listeners, BE API calls.
**You never touch:** `aligncore-be/`

### FE Step 0: Install Dependencies (Hour 1)

```bash
cd aligncore-fe
pnpm add firebase axios
```

Create `aligncore-fe/.env.local`:

```bash
# Firebase client SDK (from Firebase Console → Project Settings → Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# BE URL — switch to Cloud Run URL before the pitch
NEXT_PUBLIC_BE_URL=http://localhost:4000
```

> **Note:** `.env.local` is already in Next.js `.gitignore` — never commit it.

### FE Step 1: Firebase Client Config (Hour 1)

Create `lib/firebase.ts`:

```typescript
// aligncore-fe/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

Create `lib/api.ts` — **single place to call the BE**:

```typescript
// aligncore-fe/lib/api.ts
const BE = process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:4000'

export const api = {
  simulatePositive: () => fetch(`${BE}/api/demo/simulate-positive`),
  simulateNegative: () => fetch(`${BE}/api/demo/simulate-negative`),
  resetDemo: () => fetch(`${BE}/api/demo/reset`),

  match: (company_profile: object) =>
    fetch(`${BE}/api/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_profile }),
    }).then(r => r.json()),

  chat: (messages: { role: string; text: string }[], session_id: string) =>
    fetch(`${BE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id }),
    }).then(r => r.json()),
}
```

> **FE dev's only dependency on the BE** is this `api.ts` file and the contract in Part 0. Before the BE is ready, you can mock these calls locally.

### FE Step 2: Health Score Component (Hour 1–2)

Create `components/HealthScore.tsx`:

```typescript
// aligncore-fe/components/HealthScore.tsx
'use client'

interface Props { score: number }

export function HealthScore({ score }: Props) {
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? '#34A853' : pct >= 40 ? '#FBBC04' : '#EA4335'
  const label = pct >= 70 ? 'Healthy' : pct >= 40 ? 'At Risk' : 'Critical'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E8EAED" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${pct} 100`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{pct}%</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
    </div>
  )
}
```

### FE Step 3: Relationship Card Component (Hour 2–3)

Create `components/RelationshipCard.tsx`:

```typescript
// aligncore-fe/components/RelationshipCard.tsx
'use client'
import { HealthScore } from './HealthScore'

interface RE {
  lifecycle_state: string
  company: { name: string; industry: string; stage: string }
  mentor: { name: string; expertise: string[] }
  ai_data: { match_score: number; match_reasoning: string; confidence_level: string }
  engagement: { health_score: number; session_count: number; avg_response_hours: number }
  comms: { last_sentiment: string | null; last_message_text: string | null }
}

const STATE_COLORS: Record<string, string> = {
  PROPOSED: 'bg-yellow-100 text-yellow-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
}

const SENTIMENT_STYLES: Record<string, string> = {
  POSITIVE: 'bg-green-50 border-green-400',
  NEGATIVE: 'bg-red-50 border-red-400',
  NEUTRAL: 'bg-gray-50 border-gray-300',
}

const SENTIMENT_TEXT: Record<string, string> = {
  POSITIVE: 'text-green-700',
  NEGATIVE: 'text-red-700',
  NEUTRAL: 'text-gray-500',
}

export function RelationshipCard({ re }: { re: RE }) {
  const matchPct = Math.round(re.ai_data.match_score * 100)
  const sentiment = re.comms.last_sentiment ?? 'NEUTRAL'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATE_COLORS[re.lifecycle_state] ?? 'bg-gray-100'}`}>
            {re.lifecycle_state}
          </span>
          <h2 className="mt-2 text-lg font-bold text-gray-900">{re.company.name}</h2>
          <p className="text-sm text-gray-500">{re.company.industry} · {re.company.stage}</p>
        </div>
        <HealthScore score={re.engagement.health_score} />
      </div>

      <div className="bg-blue-50 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-900">Mentor: {re.mentor.name}</span>
          <span className="text-xs font-bold text-blue-700">{matchPct}% match</span>
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">{re.ai_data.match_reasoning}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {re.mentor.expertise.map(e => (
            <span key={e} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{e}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { value: re.engagement.session_count, label: 'Sessions' },
          { value: `${re.engagement.avg_response_hours}h`, label: 'Avg Response' },
          { value: re.ai_data.confidence_level, label: 'AI Confidence' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {re.comms.last_message_text && (
        <div className={`rounded-xl p-4 border-l-4 ${SENTIMENT_STYLES[sentiment]}`}>
          <div className="flex items-center gap-2 mb-1">
            <span>💬</span>
            <span className="text-xs font-semibold text-gray-700">Latest WhatsApp Signal</span>
            <span className={`text-xs font-bold ml-auto ${SENTIMENT_TEXT[sentiment]}`}>{sentiment}</span>
          </div>
          <p className="text-sm text-gray-700 italic">"{re.comms.last_message_text}"</p>
        </div>
      )}
    </div>
  )
}
```

### FE Step 4: Dashboard Page with Live Firestore Listener (Hours 2–4)

Replace `app/page.tsx`. This page uses the Firebase client SDK directly — **no BE call needed for real-time updates**.

```typescript
// aligncore-fe/app/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { RelationshipCard } from '@/components/RelationshipCard'
import { api } from '@/lib/api'

export default function Dashboard() {
  const [re, setRe] = useState<any>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'relationships', 'demo-re-001'), snap => {
      if (snap.exists()) {
        setRe(snap.data())
        setLastUpdate(new Date())
      }
    })
    return () => unsub()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="text-lg font-bold text-gray-900">AlignCore AI</span>
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Small Tier</span>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-500">Live · {lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relationship Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time relationship health — powered by AlignCore AI</p>
        </div>

        {re ? <RelationshipCard re={re} /> : (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            Loading...
          </div>
        )}

        {/* Demo Controls */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Demo Controls</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => api.simulatePositive()}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              Simulate Positive WA Reply
            </button>
            <button
              onClick={() => api.simulateNegative()}
              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
            >
              Simulate Negative WA Reply
            </button>
            <button
              onClick={() => api.resetDemo()}
              className="text-xs bg-gray-500 text-white px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-amber-700">These call the same code path as the real WAHA webhook via the BE.</p>
        </div>
      </div>
    </div>
  )
}
```

**Test it now** (before BE is ready):
```bash
cd aligncore-fe && pnpm dev  # runs on port 3001 by default (Next.js)
```
Open `http://localhost:3001`. The Firestore listener will show the seeded data. The demo buttons will show a network error until the BE is up — that's fine.

Once BE is running on `:4000`, the buttons work and the health score animates live.

### FE Step 5: Match Page (Hours 10–16, in parallel with BE match route)

Create `app/match/page.tsx`:

```typescript
// aligncore-fe/app/match/page.tsx
'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

interface Match {
  id: string; name: string; industry: string; expertise: string[]
  bio: string; ai_match_score: number; reasoning: string; rank: number
}

const DEFAULT_PROFILE = {
  name: 'NexGen Robotics',
  industry: 'Deep Tech / Robotics',
  stage: 'SEED',
  problem: 'We build autonomous inspection robots for manufacturing plants but struggle with scaling hardware production.',
  goals: 'Guidance on contract manufacturing, Series A fundraising, and Malaysian industrial regulations.',
}

export default function MatchPage() {
  const [form, setForm] = useState(DEFAULT_PROFILE)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMatch() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.match(form)
      setMatches(data.matches ?? [])
    } catch {
      setError('Could not connect to matching service. Check BE is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Mentor Matching</h1>
          <p className="text-sm text-gray-500 mt-1">Vertex AI embeddings + Gemini 2.0 Flash reasoning</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {(['name', 'industry', 'stage'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-700 mb-1 capitalize">{key}</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          {(['problem', 'goals'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-700 mb-1 capitalize">{key === 'goals' ? 'Mentorship Goals' : 'Problem Being Solved'}</label>
              <textarea
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleMatch}
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Matching with AI...' : 'Find Best Mentor Matches'}
          </button>
        </div>

        {matches.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Top 3 Matches</h2>
            {matches.map(m => (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-600 uppercase">#{m.rank} Match</span>
                    <h3 className="text-base font-bold text-gray-900 mt-0.5">{m.name}</h3>
                    <p className="text-xs text-gray-500">{m.industry}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{Math.round(m.ai_match_score * 100)}%</p>
                    <p className="text-xs text-gray-400">AI Score</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.expertise?.map(e => (
                    <span key={e} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{e}</span>
                  ))}
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Why this match:</p>
                  <p className="text-sm text-blue-800 leading-relaxed">{m.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### FE Step 6: Onboarding Chat Page (Hours 17–21, in parallel with BE chat route)

Create `app/onboard/page.tsx`:

```typescript
// aligncore-fe/app/onboard/page.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface Message { role: 'user' | 'model'; text: string }

const INITIAL_MESSAGE: Message = {
  role: 'model',
  text: "Hi! I'm your AlignCore AI onboarding assistant. I'll help set up your ecosystem profile so we can match you with the perfect mentor. To start — what's the name of your company and what industry are you in?",
}

export default function OnboardPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', text: input.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const data = await api.chat(updated, 'demo-session')
      setMessages(m => [...m, { role: 'model', text: data.reply }])
      if (data.profile_extracted) setProfile(data.profile_extracted)
    } catch {
      setMessages(m => [...m, { role: 'model', text: 'Sorry, I had a hiccup. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">AlignCore AI Onboarding</p>
          <p className="text-xs text-green-500">● Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs sm:max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {profile && (
        <div className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-bold text-green-800">✅ Profile created for {profile.name}</p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => router.push('/match')}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
              Find Mentor Matches →
            </button>
            <button onClick={() => router.push('/')}
              className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">
              Dashboard
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-3 items-end">
        <textarea
          rows={1}
          placeholder="Type your message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          Send
        </button>
      </div>
    </div>
  )
}
```

### FE Step 7: Layout + Navigation (Hour 21)

Update `app/layout.tsx`:

```typescript
// aligncore-fe/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AlignCore AI',
  description: 'AI-Native Ecosystem Relationship Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex flex-col">
        <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-6 text-sm sticky top-0 z-10">
          <Link href="/" className="font-bold text-blue-600">AlignCore AI</Link>
          <Link href="/" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/onboard" className="text-gray-600 hover:text-gray-900">Onboard</Link>
          <Link href="/match" className="text-gray-600 hover:text-gray-900">Match</Link>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
```

### FE Step 8: Firestore Rules (set in Firebase Console)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /relationships/{id} {
      allow read: if true;
      allow write: if false; // BE writes via Admin SDK — client never writes
    }
    match /mentors/{id} {
      allow read: if true;
    }
    match /onboarding_sessions/{id} {
      allow read: if true;
      allow write: if false; // BE writes via Admin SDK
    }
  }
}
```

### FE Step 9: Deploy to Firebase Hosting (Hour 20–21)

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

cd aligncore-fe

# Init hosting (run once)
firebase init hosting
# Choose: Use existing project → your project
# Public dir: out (for static export) OR .next (for SSR)
# Single-page app: No (App Router handles routing)

# Build and deploy
pnpm build
firebase deploy --only hosting
```

---

## Part 3 — Integration & Testing (Hours 21–22)

Both devs do this together.

### Integration Checklist

- [ ] Update `NEXT_PUBLIC_BE_URL` in `.env.local` to the Cloud Run BE URL
- [ ] Confirm `FE_ORIGIN` in BE `.env` matches the Firebase Hosting URL
- [ ] Run end-to-end demo flow on deployed URLs (not localhost):
  1. Open dashboard → confirm Firestore listener works (health score shows)
  2. Click "Simulate Positive" → confirm health score animates up
  3. Open `/match` → run matching → confirm top 3 appear with reasoning
  4. Open `/onboard` → complete a chat → confirm profile appears and navigation works
  5. Send a real WhatsApp message to the WAHA number → confirm dashboard updates live

### Port Reference

| Service | Dev URL | Notes |
|---|---|---|
| Next.js FE | `http://localhost:3001` | `pnpm dev` in `aligncore-fe/` |
| Express BE | `http://localhost:4000` | `pnpm dev` in `aligncore-be/` |
| WAHA | `http://localhost:3000` | Docker container |

---

## Part 4 — Fallback Video Recording (Hour 22–23)

> Record this **before you leave for the pitch**. It is your insurance policy if internet drops during the live demo.

**Script (8 minutes total):**
1. Show the dashboard — health score at 72%
2. Say: *"A mentor has just finished their session and sends a WhatsApp check-in reply..."*
3. Send WhatsApp message: *"Great session! We finalised the manufacturing partner strategy and Ahmad opened 3 investor intros."*
4. Show the terminal log: Gemini analysis → Firestore update
5. Show the dashboard score animate to 87% with POSITIVE sentiment card appearing
6. Navigate to `/match` → run matching → walk through the top 3 match reasoning
7. Navigate to `/onboard` → type a few messages → show profile being extracted

**Tools:** OBS Studio, Loom, or QuickTime. Export MP4 < 200 MB.

---

## Part 5 — Submission Checklist (Hour 23–24)

**Deadline: 17 May 2026, 09:00 AM via Google Form**

- [ ] GitHub repo is **public**
- [ ] `aligncore-be/README.md` explains how to run the BE locally
- [ ] `aligncore-fe/README.md` explains how to run the FE locally
- [ ] `.env` and `.env.local` are in `.gitignore` — never committed
- [ ] Presentation slides (PDF)
- [ ] Pitching video (MP4)
- [ ] Both FE and BE deployed and accessible via public URLs
- [ ] WAHA session re-authenticated against the Cloud Run WAHA instance

---

## Hour-by-Hour Summary

| Hours | BE Dev | FE Dev |
|---|---|---|
| 1 | Project setup, Express, pnpm, Firebase Admin, env | Install deps, Firebase client, `api.ts` |
| 2 | Seed script → run → confirm Firestore populated | Dashboard skeleton + `HealthScore` component |
| 2–3 | Demo simulation routes (share BE URL with FE dev) | `RelationshipCard` + live `onSnapshot` dashboard |
| 3–4 | — | Dashboard fully working with simulation buttons |
| 5–9 | WAHA Docker + session + QR scan + webhook route | Polish dashboard UI, add animation |
| 9–10 | Test real WhatsApp → webhook → Firestore → FE live | Confirm dashboard updates from real WA message |
| 10–16 | Mentor matching route (embed → similarity → Gemini reasoning) | Match page UI |
| 13–18 | Gemini chat / onboarding route | Onboarding chat page |
| 18–20 | Deploy BE + WAHA to Cloud Run | Deploy FE to Firebase Hosting |
| 20–21 | Update WAHA webhook URL to Cloud Run BE | Update `NEXT_PUBLIC_BE_URL` to Cloud Run |
| 21–22 | Integration test together (full end-to-end on prod URLs) | Same |
| 22–23 | Record fallback video together | Same |
| 23–24 | Final submission: GitHub, slides, video, Google Form | Same |

---

## Emergency Fallbacks

| What breaks | Quick fix |
|---|---|
| WAHA session expired | Click "Simulate Positive" button on dashboard — same code path |
| BE Cloud Run down | Run `pnpm dev` on BE dev's laptop, tunnel via `npx localtunnel --port 4000` |
| Gemini embedding fails | `text-embedding-004` via Gemini API is the same client — already the primary path |
| Matching too slow | Show hardcoded Firestore mentor data; narrate the AI reasoning from slides |
| Onboarding chat crashes | Demo from pre-recorded video segment |
| Entire app down | Play the fallback video |

---

## Quick Commands Reference

```bash
# ── BE ────────────────────────────────────────────────────────────────────────
cd aligncore-be
pnpm install                   # once (respects pnpm-lock.yaml)
pnpm dev                       # start BE on :4000
pnpm seed                      # seed Firestore (once)

curl http://localhost:4000/api/health
curl http://localhost:4000/api/demo/simulate-positive
curl http://localhost:4000/api/demo/simulate-negative
curl http://localhost:4000/api/demo/reset

# ── FE ────────────────────────────────────────────────────────────────────────
cd aligncore-fe
pnpm dev                       # start FE on :3001 (Next.js auto-picks if 3000 is taken)
pnpm build && firebase deploy --only hosting

# ── WAHA ──────────────────────────────────────────────────────────────────────
docker run -it --rm -p 3000:3000 \
  -e WHATSAPP_HOOK_EVENTS=message \
  -e WAHA_API_KEY=your_waha_api_key \
  devlikeapro/waha

curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_waha_api_key" \
  -d '{"name":"aligncore-demo","config":{"webhooks":[{"url":"http://host.docker.internal:4000/api/waha/webhook","events":["message"]}]}}'

curl -X POST http://localhost:3000/api/sessions/aligncore-demo/start \
  -H "X-Api-Key: your_waha_api_key"

curl http://localhost:3000/api/sessions/aligncore-demo/auth/qr \
  -H "X-Api-Key: your_waha_api_key"
```

# AlignCore AI

> **Build With AI MyHack KL 2026** &nbsp;·&nbsp; Sunway University, 16–17 May 2026  
> Problem Statement by **Cradle Fund** — *Automating Ecosystem Linkages Instead of Manual Coordination*

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [UN SDG Alignment](#3-un-sdg-alignment)
4. [Screenshots & Live Demo](#4-screenshots--live-demo)
5. [System Architecture](#5-system-architecture)
6. [Google Technology Integration](#6-google-technology-integration)
7. [AI Implementation](#7-ai-implementation)
8. [Ethical AI Considerations](#8-ethical-ai-considerations)
9. [Tech Stack](#9-tech-stack)
10. [MVP — What Was Built](#10-mvp--what-was-built)
11. [Scalability](#11-scalability)
12. [Deployment Readiness](#12-deployment-readiness)
13. [Business Model](#13-business-model)
14. [Recommendations & Future Improvements](#14-recommendations--future-improvements)
15. [Getting Started](#15-getting-started)

---

## 1. Problem Statement

> *"Regional innovation ecosystems still rely on manual coordination to create and manage relationships between key factors such as companies, mentors, partners, service providers, and programme administrators. As a result, critical linkages like mentor-to-company, company-to-programme, and partner-to-initiative are handled as one-off assignments rather than structured, reusable system entities."*  
> — Cradle Fund, MyHack 2026

Innovation ecosystem operators — Cradle Fund, accelerators, national innovation programmes — face a coordination bottleneck that worsens as they scale:

| Challenge | Consequence |
|---|---|
| Manual mentor-to-company matching | Slow, inconsistent, prone to admin bias |
| One-off relationship assignments | No reuse or learning across cohorts |
| No structured engagement tracking | Relationship health is invisible until it fails |
| Ad hoc WhatsApp groups and email | Communication exists, outcomes are unmeasured |
| Manual participant onboarding | Error-prone, time-intensive data collection |
| No platform-level memory | Past engagement data cannot improve future matching |

The core insight from the problem statement: **ecosystem relationships are not treated as first-class entities.** They should be programmable, governed, and improvable — not ad hoc tasks managed by overloaded administrators.

---

## 2. Solution Overview

**AlignCore AI** is an AI-native ecosystem relationship management platform that transforms every mentor–company linkage into a **structured, living, programmable entity** — one that can be created, governed, tracked, updated by AI, and reused across programmes.

### How It Addresses the Problem

| Root Cause | AlignCore AI Response |
|---|---|
| Manual mentor matching | AI-powered semantic matching with tool-grounded reasoning (only real mentors from the database) |
| One-off assignments | Relationship entities persisted in Firestore — reusable, queryable, filterable across any programme |
| No engagement tracking | WhatsApp sentiment analysis updates a relationship health score on every message |
| Invisible relationship health | AI-generated plain-English summaries + sparkline health history charts on the dashboard |
| Manual onboarding | Conversational AI agent guides founders through a structured 7-field profile collection |
| Gmail inbox chaos | AI automatically classifies and replies to inbound emails (onboarding requests, Q&A, partnerships) |
| No ecosystem memory | Knowledge documents uploaded per entity; agents use them for context-aware matching and Q&A |

### Target Stakeholders

- **Programme Administrators** (e.g., Cradle Fund operations team) — primary beneficiaries; their operational load is reduced most dramatically
- **Startup Founders** — faster, fairer mentor access; frictionless onboarding via chat or document upload
- **Mentors** — structured engagement with measurable impact tracking
- **Partners & Service Providers** — automated routing of partnership enquiries from the Gmail AI inbox

---

## 3. UN SDG Alignment

AlignCore AI directly contributes to four United Nations Sustainable Development Goals.

### SDG 8 — Decent Work and Economic Growth

> *"Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all."*

Healthy innovation ecosystems are a primary driver of job creation and economic growth. By removing the operational bottlenecks that slow mentor-to-company engagement, AlignCore accelerates the time-to-value for startups — helping them reach product-market fit, secure funding, and hire earlier. Every relationship that survives and thrives because it was well-matched and actively tracked represents a startup with higher odds of becoming a real employer.

The AI matching engine is also a fairness mechanism: instead of mentors being assigned to founders who happen to have existing network access, AlignCore performs semantic matching on what a company actually needs — giving underrepresented founders equal access to the right expertise.

---

### SDG 9 — Industry, Innovation and Infrastructure

> *"Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation."*

AlignCore AI is itself a piece of innovation infrastructure — the programmable coordination layer that regional innovation ecosystems are currently missing. By treating ecosystem relationships as structured, reusable entities rather than ad hoc tasks, it provides the institutional memory and repeatability that allows programmes to scale to new geographies and cohorts without proportional growth in administrative overhead.

The use of Google ADK, Gemini, Firestore, and Cloud Run demonstrates how modern AI infrastructure can be applied to solve real institutional coordination problems — not just consumer applications.

---

### SDG 10 — Reduced Inequalities

> *"Reduce inequality within and among countries."*

Manual matching in innovation ecosystems is inherently unequal — it favours founders who are already well-networked, articulate in the dominant language, and known to programme administrators. AlignCore levels this by:

- **Document-first onboarding:** Founders can upload a pitch deck in any format (PDF, DOCX, PPTX) and have Gemini extract their profile — removing the barrier of filling out complex forms
- **Conversational onboarding:** A chat-based 7-field profile collection lowers the literacy barrier compared to traditional web forms
- **Algorithmic matching with transparent reasoning:** Every match recommendation includes a plain-English explanation. Administrators can see and challenge the AI's reasoning — surfacing cases where a strong founder may have been underrated by keyword-based systems

The long-term roadmap includes voice onboarding via the Gemini Live API — allowing founders in underserved communities to onboard through natural conversation in their preferred language.

---

### SDG 17 — Partnerships for the Goals

> *"Strengthen the means of implementation and revitalize the global partnership for sustainable development."*

AlignCore AI is, at its core, a partnership infrastructure tool. It automates the creation, management, and continuous improvement of the partnerships that make innovation ecosystems function — mentor-to-company, company-to-programme, partner-to-initiative.

By making partnerships programmable and measurable, AlignCore enables ecosystem operators to answer questions that were previously unanswerable: Which mentor-company pairings are at risk? Which industries are underserved in the current mentor pool? Which partnership patterns have the highest health score trajectories? This evidence base allows Cradle Fund and similar bodies to deploy their limited resources where partnerships are most needed — strengthening the quality and inclusivity of the national innovation partnership network.

---

## 4. Screenshots & Live Demo

### Dashboard — Real-Time Relationship Overview

![Dashboard](doc/images/AlignCore%20UI%20-%20Dashboard%20Page.png)

The dashboard shows every mentor–company relationship as a live card with an AI-generated health summary, lifecycle status badge (`ACTIVE` / `AT_RISK` / `PAUSED` / `COMPLETED`), and a sparkline chart of historical health scores. Cards update in real-time via Firestore listeners — a new WhatsApp message that changes sentiment is reflected on-screen within seconds.

### Ecosystem Analytics

![Analytics](doc/images/AlignCore%20UI%20-%20Analytics%20Page.png)

Live aggregated analytics across all entities and relationships — industry distribution (donut chart), relationship health distribution, lifecycle state breakdown, and WhatsApp sentiment trends. Powered by client-side Recharts with Firestore snapshot listeners.

### Company Directory

![Companies](doc/images/AlignCore%20UI%20-%20Companies%20Page.png)

Full company entity management: create, search, edit, upload photos, attach knowledge documents, and bulk-import via CSV. Profile data can be AI-extracted by uploading a pitch deck PDF, DOCX, or PPTX — Gemini reads the document and populates all structured fields automatically.

### WhatsApp Connection (WAHA)

![WhatsApp QR](doc/images/AlignCore%20UI%20-%20Scan%20QR%20Login%20WhatsApp.png)

In-app WhatsApp session management — scan a QR code to authenticate, then AlignCore automatically creates a dedicated WhatsApp group for each new mentor–company relationship (when both parties have phone numbers registered).

---

## 5. System Architecture

![System Architecture Diagram](doc/images/System%20Architecture%20Diagram.png)

AlignCore AI runs on a fully Google Cloud-native architecture. Every component maps to a managed GCP service.

```
Browser / Operations Team
        │
        ▼
Firebase Hosting  ──────────────────────────────────────────
(Next.js 16 frontend)                                      │
        │                                                  │
        │  REST API calls                    Real-time     │
        ▼                                   Firestore      │
Cloud Run ◄─────────────────────────────── listeners       │
(Node.js + Express backend,                                │
 Dockerized)                                               │
        │                                                  │
        ├──► Cloud Firestore (aligncore-db)  ◄─────────────┘
        │    [companies, mentors, relationships,
        │     knowledge_docs, activity_log, gmail_logs]
        │
        ├──► Google Cloud Storage (aligncore-knowledge-base)
        │    [knowledge/{type}/{id}/{file}, photos/]
        │
        ├──► Vertex AI / Gemini 2.5 Flash
        │    [9 ADK agents — matching, extraction,
        │     sentiment, onboarding, summarization, email]
        │
        ├──► Compute Engine VM (e2-small, WAHA)
        │    WhatsApp ──► WAHA Docker ──► Webhook ──► Cloud Run
        │
        └──► Gmail API + Cloud Pub/Sub
             Gmail ──► Pub/Sub topic ──► Cloud Run (AI inbox)
```

**Future extension (architecture-ready):** BigQuery dataset (`aligncore-ml`) for historical analytics and ML-based matching improvement, connected to the same Cloud Run backend via export jobs.

### Infrastructure Evidence

| Firestore Collections (Live) | Cloud Storage Bucket (Live) |
|---|---|
| ![Firestore](doc/images/AlignCore%20Firestore%20Screenshot.png) | ![Cloud Storage](doc/images/AlignCore%20Cloud%20Storage%20Bucket.png) |

| WAHA on Compute Engine (Live) | Gmail Pub/Sub Subscription (Live) |
|---|---|
| ![Compute Engine VM](doc/images/WAHA%20Compute%20Engine%20VM.png) | ![Gmail Pub/Sub](doc/images/Gmail%20Pub-Sub%20Setup.png) |

| WAHA Session Dashboard (Live) |
|---|
| ![WAHA Dashboard](doc/images/AlignCore%20WAHA%20Dashboard.png) |

---

## 6. Google Technology Integration

AlignCore AI integrates **six distinct Google Developer technologies**, each chosen to solve a specific architectural problem — not as decoration.

### Google Agent Development Kit (ADK) + Gemini 2.5 Flash

**Why chosen:** ADK provides a production-grade agentic framework with native tool-use, multi-step reasoning, and typed structured output — essential for reliable agent orchestration in a production system. Gemini 2.5 Flash was selected over alternatives because it combines superior reasoning-per-cost with native multimodal PDF understanding and a long context window capable of processing full pitch decks and conversation histories in a single call.

**How it enhances the solution:** Nine specialized ADK agents handle every AI task — from semantically matching mentors using Firestore as a real-time knowledge tool, to reading WhatsApp message sentiment, to autonomously replying to Gmail enquiries with ecosystem-specific knowledge. Using ADK rather than raw API calls means tool calls, retry logic, and session management are handled by the framework; the team focuses on agent behavior, not plumbing.

**Key implementation files:**
- `aligncore-be/src/lib/adk.ts` — stateless `InMemoryRunner` wrapper (`runAgent`)
- `aligncore-be/src/lib/agents/` — all 9 agent definitions

---

### Firebase (Firestore + Hosting)

**Why chosen:** Firestore's real-time listener model and subcollection support perfectly fit the data shape of ecosystem management — a relationship entity with a time-series health history as a subcollection is a natural Firestore pattern. Firebase Hosting provides zero-configuration global CDN deployment for the Next.js frontend.

**How it enhances the solution:** The frontend subscribes to Firestore snapshots using the Firebase SDK. When a WhatsApp message triggers a sentiment analysis that updates `health_score` on a relationship document, the dashboard card updates live without a page refresh or polling. Subcollections model `relationships/{id}/history` as an efficient time-series without document-level array growth.

**Named database:** `aligncore-db` (not the default instance, demonstrating multi-database awareness)

---

### Google Cloud Run

**Why chosen:** Cloud Run's stateless container execution model matches the architecture — every API request is independent with no server-side session state or in-memory data. Autoscaling from 0 to N instances handles burst traffic from concurrent ecosystem programmes without over-provisioning.

**How it enhances the solution:** The Node.js Express backend is packaged as a Docker image (Node 20-slim, multi-stage build with pnpm) and deployed to Cloud Run. Cold starts are minimized by the slim image size. The backend scales to zero during off-hours, keeping infrastructure costs proportional to actual usage.

---

### Google Cloud Storage (GCS)

**Why chosen:** Firestore has a 1 MB per-document limit, making it unsuitable for storing PDFs, DOCX files, and high-resolution photos directly. GCS provides durable object storage with fine-grained IAM and signed URL support, cleanly separating metadata (Firestore) from binary content (GCS).

**How it enhances the solution:** Knowledge documents (pitch decks, CVs, credential files) are stored in GCS under structured prefixes (`knowledge/{entity_type}/{entity_id}/{filename}`). Extracted text is indexed in Firestore's `knowledge_docs` collection. When the `matchAgent` or `qnaAgent` needs document context, it fetches the pre-extracted text from Firestore — not from GCS — keeping agent tool calls fast.

---

### Gmail API + Google Cloud Pub/Sub

**Why chosen:** Programme administrators receive a high volume of inbound emails that historically required manual triage. The Gmail API provides read/send access; Pub/Sub provides real-time webhook delivery without polling, eliminating the need for a scheduled job.

**How it enhances the solution:** When a new email arrives, Gmail pushes a notification to a Pub/Sub topic, which delivers it to the Cloud Run backend via HTTP push subscription. The backend fetches the email, runs it through `emailClassifierAgent` (ONBOARDING / QNA / PARTNERSHIP / OTHER), and either auto-replies with `qnaAgent` using the ecosystem knowledge base, or routes it to the operations team via WhatsApp. Every action is logged to `gmail_logs` in Firestore.

---

### Google Compute Engine (WAHA VM)

**Why chosen:** WhatsApp does not provide a free Business API for prototype-scale deployments. WAHA (WhatsApp HTTP API) is an open-source bridge that runs as a Docker container and exposes WhatsApp functionality over HTTP — deployed on a GCE `e2-small` VM (~$7/month) in the `asia-southeast1` region.

**How it enhances the solution:** Every relationship created with phone numbers for both parties automatically triggers WAHA to create a WhatsApp group. Messages sent in those groups flow via webhook to Cloud Run, where `wahaAgent` scores sentiment and updates the relationship health score — creating a passive, zero-friction engagement tracking layer.

---

## 7. AI Implementation

AI is the operational core of AlignCore AI. Every critical workflow has a dedicated AI agent. Without the agents, the platform is a CRM. With them, it is an autonomous ecosystem coordination system.

### The 9 ADK Agents

All agents use `LlmAgent` from `@google/adk` v1.1.0, executed via a stateless `InMemoryRunner`. Model: `gemini-2.5-flash` (configurable via `AI_MODEL` env var with Vertex AI support).

| Agent | File | Role | ADK Tools |
|---|---|---|---|
| `extractAgent` | `agents/extractAgent.ts` | Extract structured company profile (name, industry, stage, about, problem, goals, size) from unstructured text | None — pure LLM classification with strict JSON output |
| `mentorExtractAgent` | `agents/mentorExtractAgent.ts` | Extract mentor profile (name, bio, industry, expertise tags) from uploaded CV/bio/credentials | None |
| `matchAgent` | `agents/matchAgent.ts` | Rank top-3 mentor matches for a company with scores and reasoning | `searchMentorsByIndustry`, `searchMentorsByExpertise`, `getAllAvailableMentors`, `getEntityKnowledge` |
| `onboardingAgent` | `agents/onboardingAgent.ts` | Conversational 7-field company onboarding; outputs `<PROFILE>JSON</PROFILE>` when complete | None (stateless multi-turn — FE sends full history per request) |
| `wahaAgent` | `agents/wahaAgent.ts` | Classify WhatsApp message sentiment + compute health score delta (−0.3 to +0.3) | None |
| `summaryAgent` | `agents/summaryAgent.ts` | Generate plain-English 2–3 sentence relationship health summary | `getRelationshipHistory`, `getEntityKnowledge` |
| `emailClassifierAgent` | `agents/emailClassifierAgent.ts` | Classify inbound email as ONBOARDING / QNA / PARTNERSHIP / OTHER | None |
| `qnaAgent` | `agents/qnaAgent.ts` | Auto-reply to Q&A emails using ecosystem knowledge base; returns `CANNOT_ANSWER` when unsure | None |
| `onboardingReplyAgent` | `agents/onboardingReplyAgent.ts` | Generate onboarding link reply email for founders | None |

### Why Gemini 2.5 Flash?

| Requirement | Why Gemini 2.5 Flash Delivers |
|---|---|
| Multimodal PDF understanding | Native — pitch deck PDFs passed directly as binary input; no OCR preprocessing required |
| Structured JSON output | Function calling + strict output schema prevents hallucinated field values |
| High-frequency sentiment analysis | Flash tier cost-efficiency makes per-message sentiment scoring economically viable |
| Long context onboarding | Full conversation history (multi-turn) fits within the context window without truncation |
| Tool use reliability | ADK tool orchestration with Gemini is first-class — tool schemas are natively understood |

### Key AI Data Flows

**Mentor Matching:**
```
User uploads pitch deck PDF / fills in company profile
  → Gemini multimodal extracts raw text (PDF) or extractAgent parses text
  → matchAgent calls searchMentorsByIndustry → searchMentorsByExpertise (Firestore tools)
  → getEntityKnowledge enriches with company's uploaded docs
  → Returns 3 ranked mentors: { name, match_score, match_reasoning }
  → Administrator creates relationship → WAHA auto-creates WhatsApp group
```

**WhatsApp Sentiment Pipeline:**
```
Message sent in mentor-company WhatsApp group
  → WAHA webhook → POST /api/waha/webhook
  → Backend resolves relationship by group JID or phone number lookup
  → wahaAgent: "POSITIVE / NEUTRAL / NEGATIVE" + health_score_delta
  → Firestore: relationship.engagement.health_score += delta
  → Subcollection: relationships/{id}/history ← { score, sentiment, timestamp }
  → Frontend Firestore listener: dashboard health card updates in real-time
```

**Gmail Inbox Automation:**
```
New email → Gmail push notification → Pub/Sub → POST /api/gmail/process-inbox
  → emailClassifierAgent: ONBOARDING | QNA | PARTNERSHIP | OTHER
  → ONBOARDING: onboardingReplyAgent drafts link email → Gmail API sends
  → QNA: qnaAgent reads knowledge base → Gmail API sends reply (or CANNOT_ANSWER → human)
  → PARTNERSHIP: owner notified via WhatsApp
  → Log written to gmail_logs collection
```

**AI Relationship Summary:**
```
Administrator clicks "Generate Summary"
  → POST /api/ai/summary/{relationshipId}
  → summaryAgent calls getRelationshipHistory (health history, last sentiment, comms)
  → getEntityKnowledge (company and mentor docs for context)
  → Returns 2–3 sentence plain-English summary
  → Stored on relationship.ai_summary + displayed on dashboard card
```

---

## 8. Ethical AI Considerations

Responsible AI is a design constraint in AlignCore — not a checklist item completed after the fact.

### Hallucination Mitigation

**Strict output contracts enforced by Zod schemas.**  
Every agent returns a typed JSON structure. The backend validates the parsed response against a Zod schema on every agent call. If the model returns a malformed or incomplete structure, the request fails with a clear error — it is never passed to users or written to the database. Agents cannot "drift" into unstructured responses.

**Tool-grounded matching — agents cannot invent mentors.**  
The `matchAgent` is given Firestore query tools and instructed to use them before producing recommendations. It can only recommend mentors that actually exist in the database — with name, bio, industry, and expertise returned directly from Firestore, not from model memory. This is the most critical hallucination risk in a matching system, and it is architecturally eliminated.

**Conservative sentiment deltas.**  
The `wahaAgent` is constrained to output health score deltas in the range `[-0.3, +0.3]` per message. A single anomalous or misclassified message cannot catastrophically change a relationship's status. Health scores shift gradually, requiring sustained positive or negative patterns to meaningfully change the relationship lifecycle state.

**Explicit "I don't know" for Q&A.**  
The `qnaAgent` is instructed to return the literal string `CANNOT_ANSWER` when the knowledge base does not contain sufficient information to respond confidently. An email that triggers `CANNOT_ANSWER` is not auto-replied; instead it is flagged for human review and logged. This prevents plausible-sounding but incorrect information from being sent to founders.

### Bias Considerations

**Multi-signal mentor search.**  
The `matchAgent` calls `searchMentorsByIndustry` and `searchMentorsByExpertise` as separate Firestore queries before producing its final ranking. Mentors who don't perfectly match the primary industry tag are not silently excluded — they are retrieved via the expertise query and may rank highly based on other signals. This reduces the risk of industry-label bias excluding strong matches.

**Transparent, human-overridable recommendations.**  
Every mentor match includes a `match_reasoning` field — a short plain-English explanation of why this mentor was recommended. Administrators read, challenge, and override AI recommendations. The AI produces a ranked shortlist; humans make the final decision. No relationship is created without an administrator explicitly clicking "Create Relationship."

**Diversity of training signals.**  
When the knowledge base is used during matching (`getEntityKnowledge`), the agent reads the full extracted text of company documents — not just structured labels. This allows nuanced company contexts (social enterprise, rural market, niche B2B) to influence matching in ways that structured fields alone would miss.

### Privacy

**WhatsApp messages are not stored verbatim.**  
The `wahaAgent` receives message content to classify sentiment, but only the derived `sentiment` label, `health_score_delta`, and a short `last_message_preview` (~100 characters) are persisted in Firestore. Full message content is never written to the database. Conversation privacy between mentors and companies is preserved.

**Email bodies are not fully stored.**  
The Gmail processor writes only a `body_preview` (first ~200 characters) to the `gmail_logs` collection — not the complete email body. Full email content is used transiently in memory for agent processing and then discarded.

**GCS access is backend-only.**  
Knowledge documents are stored in a private GCS bucket (`aligncore-knowledge-base`) with no public access policy. Files are accessible only via the authenticated backend service account — the frontend never receives a direct GCS URL. Extracted text (not the raw file) is what agents receive, and it is scoped to the entity requesting it.

**Data minimization at every layer.**  
The platform collects only the data that serves a specific function. WhatsApp numbers are digits-only (no name lookup). Mentor and company profiles contain only information explicitly provided by the entity. There is no behavioral tracking of front-end users.

### Transparency

**Activity log as a full audit trail.**  
Every AI action — extraction, match, summary generation, email reply, sentiment update — is written to the `activity_log` Firestore collection with: the entity affected, the action type, a human-readable detail string, and a timestamp. The Activity page in the UI surfaces this log to administrators so no AI operation is opaque.

**AI summary metadata.**  
AI-generated relationship summaries are displayed with the `ai_summary_updated_at` timestamp, so administrators know exactly when the last AI assessment was generated. A "Regenerate" button is available — the system does not silently auto-update summaries without indication.

**No silent automation.**  
Every autonomous action taken by the system (auto-replies sent, WhatsApp groups created, health scores updated) is logged to the activity feed and visible to the operations team. Administrators can review what the system did and why at any time.

---

## 9. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | 16.2.6 | Ecosystem management UI |
| **UI Library** | React | 19.2.4 | Component model |
| **Styling** | Tailwind CSS | 4 | Dark-mode utility-first design |
| **Charts** | Recharts | 3.8.1 | Analytics visualizations |
| **Backend Runtime** | Node.js + Express | 20 / 4.x | REST API server |
| **Language** | TypeScript | 5.4.5 | Type safety across FE + BE |
| **AI Framework** | Google ADK | 1.1.0 | Agent orchestration + tool use |
| **AI Model** | Gemini 2.5 Flash | gemini-2.5-flash | LLM for all 9 agents |
| **Database** | Cloud Firestore | firebase-admin 12.2 | Entity + relationship store |
| **Object Storage** | Google Cloud Storage | — | Knowledge docs + photos |
| **Backend Deployment** | Google Cloud Run | Docker / Node 20-slim | Auto-scaling containerized API |
| **Frontend Hosting** | Firebase Hosting | — | CDN-delivered Next.js |
| **WhatsApp Bridge** | WAHA on Compute Engine | e2-small, GOWS | WhatsApp webhook relay |
| **Email Integration** | Gmail API + Cloud Pub/Sub | — | AI inbox automation |
| **Validation** | Zod | 4.4.3 | Schema validation on API boundaries |
| **DOCX Parsing** | mammoth | — | Word document text extraction |
| **PPTX Parsing** | adm-zip | — | ZIP-based slide XML extraction |
| **PDF Parsing** | Gemini multimodal | — | Native PDF understanding (no OCR) |
| **File Uploads** | multer | — | Multipart form handling (15–20 MB limits) |
| **Package Manager** | pnpm | 10.33.2 | Monorepo dependency management |

---

## 10. MVP — What Was Built

Everything listed below is implemented, functional, and demonstrable.

### Entity Management
- [x] Full CRUD for **Companies** — name, industry (enum), stage (enum), about, problem statement, goals, size, WhatsApp number, profile photo
- [x] Full CRUD for **Mentors** — name, bio, expertise tags (closed set), industry, availability toggle, WhatsApp number, profile photo
- [x] Full CRUD for **Relationships** — lifecycle state management, engagement health score, communications log (last sentiment, last WhatsApp message preview, last activity timestamp), AI summary, match score, match reasoning, notes
- [x] **Cascading updates** — renaming a company propagates the new name to all linked relationship documents
- [x] **Duplicate prevention** — the system prevents creating a second relationship between the same mentor and company

### AI-Powered Workflows
- [x] **Company profile extraction from documents** — upload PDF, DOCX, or PPTX; Gemini reads the document and populates all structured company fields (`POST /api/ai/extract-doc`)
- [x] **Mentor profile extraction from documents** — upload up to 5 files (CV, bio, credentials); agent extracts mentor fields including expertise tags (`POST /api/ai/extract-mentor-doc`)
- [x] **Plain-text extraction** — paste unstructured text; `extractAgent` parses it into structured fields (`POST /api/ai/extract`)
- [x] **Conversational onboarding** — 7-field multi-turn chat; `onboardingAgent` guides founders through profile collection and auto-creates the company record when complete (`POST /api/chat`)
- [x] **Mentor matching** — company profile in → 3 ranked mentor recommendations with scores and reasoning out (`POST /api/match`)
- [x] **Relationship health summary** — on-demand AI summary of engagement trend using health history and entity knowledge docs (`POST /api/ai/summary/:id`)
- [x] **WhatsApp sentiment analysis** — every group message scored; relationship health score updated in real-time via webhook
- [x] **Gmail AI inbox** — inbound emails auto-classified (ONBOARDING / QNA / PARTNERSHIP / OTHER) and auto-replied using ecosystem knowledge

### Knowledge Base
- [x] **Document upload per entity** — PDF, DOCX, PPTX (up to 20 MB) stored in GCS; text extracted and indexed in Firestore (`POST /api/knowledge/:type/:id/upload`)
- [x] **Knowledge doc listing and deletion** per entity
- [x] **Agent integration** — `matchAgent` and `summaryAgent` call `getEntityKnowledge` tool to pull uploaded document text for context-aware responses

### Data Ingestion
- [x] **CSV bulk import** — import up to 50 companies from a CSV file in one upload (`POST /api/entities/companies/batch`)
- [x] **Profile photo upload** — for both companies and mentors; stored in GCS with URL stored on entity document

### WhatsApp Integration
- [x] **Auto-created WhatsApp groups** — when a relationship is created with both party phone numbers, WAHA creates the group automatically
- [x] **Async group linking** — WAHA's `createKey` pattern handles cases where the group JID is returned asynchronously via the `group.v2.join` webhook event
- [x] **In-app QR login** — administrators scan a QR code inside the AlignCore UI to authenticate WAHA (no CLI needed)
- [x] **Session management** — start, restart, and status-check the WAHA session from the Settings page

### Dashboards & Analytics
- [x] **Real-time relationship dashboard** — health sparklines, lifecycle badges, AI summaries, live Firestore listeners
- [x] **Ecosystem analytics** — industry distribution, relationship health distribution, lifecycle state chart, sentiment trends (all powered by Recharts)
- [x] **Activity log** — real-time feed of every AI and CRUD operation with entity context and timestamp

---

## 11. Scalability

Scalability is an architectural property of AlignCore — not a future concern. Every component is built on a service that scales independently.

### Technical Scalability

**Stateless backend (Cloud Run)**  
The Express API holds no in-process state — no sessions, no caches, no file system dependencies. Cloud Run scales from 0 to hundreds of container instances automatically. An ecosystem growing from 50 to 50,000 mentor–company relationships requires zero backend code changes. Scale is a configuration dial.

**Stateless agent execution**  
Each ADK agent call uses an `InMemoryRunner` that creates and discards an ephemeral session per request. 100 simultaneous matching requests spawn 100 independent agent instances in parallel — there is no agent state that could become a bottleneck or a race condition.

**Firestore horizontal scaling**  
Firestore is a serverless, automatically sharded NoSQL database that scales to millions of documents with no operator intervention. The data model is designed to avoid hot-key issues:
- Entity queries use compound indexes (e.g., filter relationships by `status` + `mentor_id`)
- Health history is a subcollection (`relationships/{id}/history`) — it grows independently and never increases the parent document's size or read cost
- Denormalized fields (`company_name`, `mentor_name` on relationships) eliminate cross-collection joins that would degrade at scale

**Google Cloud Storage**  
GCS scales infinitely. Structured key prefixes (`knowledge/{entity_type}/{entity_id}/{filename}`) enable per-entity listing without scanning the full bucket. Adding a new country or programme adds new prefix paths — no structural changes.

**Gemini API tier upgrade path**  
The backend defaults to the Gemini Developer API (`GEMINI_API_KEY`). Setting `GEMINI_USE_VERTEX=true` switches all agent calls to Vertex AI — unlocking enterprise SLAs, higher rate limits, and regional data residency controls. This is a single environment variable change, not an architectural one.

**BigQuery analytics layer (architecture-ready)**  
The system architecture includes an `aligncore-ml` BigQuery dataset. As relationship data accumulates, health score time-series, matching decisions, and engagement outcomes can be exported to BigQuery via scheduled Dataflow jobs. BigQuery ML then trains a data-driven matching model on top of actual outcomes — replacing the current LLM heuristic ranker with a model that improves as the ecosystem grows.

### Operational Scalability

**Multi-programme architecture**  
The current data model supports a `programme_id` field extension on `relationships` and `companies`. A single AlignCore instance can serve multiple Cradle programmes simultaneously — with filtered views per programme for each administrator team. No new infrastructure is required to onboard a new programme; it is a configuration at the data layer.

**Multi-country deployment**  
Cloud Run supports multi-region deployment with global load balancing. A new country instance is provisioned by deploying to a new GCP region (`asia-east1` for Taiwan, `europe-west1` for Europe) with a region-local Firestore database. Data sovereignty is preserved; the application code is unchanged.

**WAHA horizontal scaling**  
Multiple WAHA Compute Engine VMs can run in parallel — one per WhatsApp business account. All route their webhooks to the same Cloud Run backend. The backend normalizes phone numbers and resolves relationships by phone number or group JID regardless of which WAHA instance forwarded the event.

### Cost Scaling Model

| Component | Pricing Model | Scales With |
|---|---|---|
| Cloud Run | Pay per CPU-second per request | Number of API calls |
| Firestore | Pay per read/write operation | Number of entities + relationship updates |
| Gemini 2.5 Flash | Pay per input/output token | Number of AI operations |
| Cloud Storage | Pay per GB stored + per operation | Volume of knowledge documents |
| Firebase Hosting | Generous free tier | Frontend traffic |
| Compute Engine (WAHA) | Fixed ~$7/month per VM | Number of WhatsApp accounts |
| Cloud Pub/Sub | Pay per message | Gmail inbox volume |

**Estimated monthly cost for 500 relationships, 1,000 WhatsApp messages/day:**  
~RM 60–100/month (Cloud Run + Gemini tokens dominant). At this scale, AlignCore is profitable at any SaaS price point above RM 500/month.

**At 10,000 relationships:** Each component scales linearly or sub-linearly. The biggest cost driver is Gemini token consumption, which is directly controllable by batching summary generation and caching common knowledge retrievals.

---

## 12. Deployment Readiness

AlignCore AI is running today. The following infrastructure is live, not hypothetical.

### Current Live Infrastructure

| Component | Status | GCP Service |
|---|---|---|
| Backend API | Dockerized + Cloud Run-ready | Google Cloud Run |
| Frontend | Next.js build + Firebase Hosting-ready | Firebase Hosting |
| Firestore database | Live (`aligncore-db`) | Cloud Firestore |
| GCS knowledge bucket | Live (`aligncore-knowledge-base`) | Google Cloud Storage |
| WAHA WhatsApp session | Live (authenticated, connected) | Compute Engine e2-small |
| Gmail Pub/Sub subscription | Live (active subscription) | Cloud Pub/Sub + Gmail API |

### Prototype → Production Roadmap

| Step | What | Priority |
|---|---|---|
| Authentication | Firebase Auth with RBAC (admin / viewer / mentor self-service roles) | High |
| Security rules | Harden Firestore security rules per collection and role | High |
| Secret management | Migrate `.env` to Google Secret Manager + Cloud Run secret injection | High |
| Custom domain | Map domain to Firebase Hosting + Cloud Run via HTTPS load balancer | Medium |
| Observability | Cloud Monitoring dashboards for API error rates, agent latency, Firestore ops | Medium |
| CI/CD | GitHub Actions: Docker build → Cloud Run deploy on merge to `main` | Medium |
| Rate limiting | API-level rate limiting on `POST /api/match` and `POST /api/ai/*` | Medium |
| SLA & caching | Cache frequent `matchAgent` calls for identical company profiles (Redis / Memorystore) | Low |

---

## 13. Business Model

### Revenue Model — SaaS Subscription

**Primary target:** Innovation ecosystem operators — government-linked entities (Cradle Fund, MDEC, MaGIC), accelerators, corporate innovation programmes, and VC networks.

| Tier | Price (MYR/month) | Included |
|---|---|---|
| **Starter** | RM 500 | 50 companies, 20 mentors, AI matching + extraction |
| **Growth** | RM 2,000 | 500 companies, full AI suite, WhatsApp + Gmail automation |
| **Enterprise** | Custom (RM 5k–10k) | Unlimited, multi-programme, BigQuery analytics, SLA, dedicated support |

**Unit economics at Growth tier:**  
- Monthly GCP cost (500 relationships, moderate activity): ~RM 100  
- Gross margin at RM 2,000/month: ~95%  
- Break-even: 1 paying customer covers the infrastructure for ~20 Growth customers

**Adjacent revenue streams:**
- Implementation & onboarding fees for large ecosystem operators
- API access tier for third-party ecosystem platforms integrating with AlignCore
- Programme impact reporting as a service (BigQuery ML analytics)

### Why This Is Defensible

The platform's value compounds over time. Every relationship created, every match outcome recorded, and every document uploaded makes the system smarter — the matching model improves, the Q&A knowledge base deepens, and the ecosystem graph becomes a proprietary asset. A competitor building the same interface does not inherit this data moat.

### Differentiation

| Capability | AlignCore AI | Generic CRM (Salesforce/HubSpot) | Spreadsheets |
|---|---|---|---|
| AI mentor matching (semantic) | Yes — tool-grounded, no hallucinations | No | No |
| WhatsApp group auto-creation | Yes | No | No |
| Real-time sentiment → health score | Yes | No | No |
| Conversational AI onboarding | Yes | No | No |
| Gmail AI inbox (classify + reply) | Yes | Limited (no domain-specific AI reply) | No |
| Ecosystem-specific data model | Yes — relationships are first-class | No — generic contact/deal model | No |
| Cost at 500 relationships | ~RM 100/month infra | RM 3,000–10,000/month per seat | Hidden (human hours) |

---

## 14. Recommendations & Future Improvements

### High Priority (Next Sprint)

**1. Firebase Authentication + RBAC**  
Add role-based access: `programme_admin` sees all entities, `mentor` sees only their own profile and linked relationships, `viewer` gets read-only analytics. Firebase Auth + Firestore security rules enable this without a separate auth service.

**2. Persistent Onboarding Sessions**  
Currently, the onboarding chat sends the full conversation history per request (stateless). Migrating to Firestore-backed ADK sessions would allow founders to resume incomplete onboarding flows across browser sessions and devices.

**3. Automated Lifecycle Escalation**  
Define a configurable health score threshold (e.g., `< 30` for 7 consecutive days). The system automatically updates `lifecycle = AT_RISK` and notifies the programme administrator via email or WhatsApp. Currently this requires manual administrator observation.

**4. Hardened Firestore Security Rules**  
Replace the current permissive development rules with production rules: authenticated writes only, read scoped by `programme_id`, mentor self-service locked to their own document.

### Medium Priority (Next Quarter)

**5. Matching Feedback Loop**  
When an administrator accepts or rejects a match recommendation, store that signal in a `match_feedback` collection. Aggregate these signals to fine-tune system instructions or, when enough data exists, train a BigQuery ML ranking model on actual outcomes.

**6. Multi-Programme Support**  
Add a `programmes` entity. Companies, mentors, and relationships are scoped to one or more programmes. Programme-level analytics let Cradle Fund compare cohort performance across initiatives without data contamination.

**7. Google Calendar Integration**  
Connect mentor availability via the Google Calendar API. The matching system surfaces only mentors with available slots; session scheduling and reminders are handled within the platform — eliminating the back-and-forth email scheduling that currently happens outside the system.

**8. Document Versioning**  
Track uploaded document versions per entity. When a company updates their pitch deck, the previous version is archived with a timestamp. Agents always use the latest version, but the history is preserved for audit purposes.

**9. WhatsApp Broadcast**  
Allow programme administrators to send a message to all mentor-company WhatsApp groups simultaneously — programme deadline reminders, milestone check-in prompts, or cohort announcements — from a single in-platform action.

### Long-Term Vision

**10. BigQuery ML Matching Model**  
Export matching decisions, health score trajectories, and relationship lifecycle outcomes to BigQuery. Train a supervised ranking model on what made a relationship succeed — replacing the current LLM heuristic with a model that improves measurably as the ecosystem grows.

**11. Partner & Service Provider Entity Type**  
Extend beyond companies and mentors to include partners, investors, legal advisors, and service providers as entity types. AI-governed linkages between companies and service providers (legal, finance, HR) would automate a much larger surface area of ecosystem coordination — closer to the full vision in the problem statement.

**12. Voice Onboarding via Gemini Live API**  
Allow founders to onboard by speaking naturally — the Gemini Live API transcribes and extracts all 7 profile fields from a voice call in real-time. This dramatically lowers the digital literacy barrier for founders in underserved communities or those unfamiliar with web forms.

**13. National Ecosystem Health Index**  
Aggregate anonymized health scores and engagement data across all programmes into a public-facing dashboard — surfacing which sectors, stages, and geographies are underserved in the national innovation ecosystem. This transforms AlignCore from an operations tool into a policy intelligence platform.

---

## 15. Getting Started

### Prerequisites

- Node.js 20+, pnpm 10+
- A Google Cloud project with Firestore, Cloud Storage, and Cloud Run APIs enabled
- A Gemini API key (or Vertex AI access)
- (Optional) A running WAHA instance for WhatsApp integration
- (Optional) Gmail OAuth2 credentials for inbox automation

### Backend

```bash
cd aligncore-be
cp .env.example .env        # Configure credentials (see below)
pnpm install
pnpm dev                    # Express server starts on port 4000
```

### Frontend

```bash
cd aligncore-fe
cp .env.local.example .env.local   # Configure Firebase + backend URL
pnpm install
pnpm dev                           # Next.js starts on port 3000
```

### Key Environment Variables

**Backend (`.env`):**
```env
PORT=4000
FE_ORIGIN=http://localhost:3000

# AI
GEMINI_API_KEY=your_gemini_api_key
AI_MODEL=gemini-2.5-flash

# Firebase / Firestore
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIRESTORE_DATABASE_ID=aligncore-db

# GCS
KNOWLEDGE_BUCKET=your-gcs-bucket-name

# WhatsApp (WAHA)
WAHA_URL=http://your-waha-instance
WAHA_SESSION=default
WAHA_API_KEY=your-waha-api-key

# Gmail
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER_EMAIL=...
```

**Frontend (`.env.local`):**
```env
NEXT_PUBLIC_BE_URL=http://localhost:4000
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=aligncore-db
```

### Docker (Backend)

```bash
cd aligncore-be
docker build -t aligncore-be .
docker run -p 4000:4000 --env-file .env aligncore-be
```

---

*Built in 24 hours at **Build With AI MyHack KL 2026**, Sunway University — powered by Google ADK, Gemini 2.5 Flash, Firebase, Cloud Run, Cloud Storage, Compute Engine, and Pub/Sub.*

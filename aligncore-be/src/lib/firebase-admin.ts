import fs from 'fs'
import path from 'path'
import {
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/** Normalize path so applicationDefault always finds the file (Windows / monorepo cwd quirks). */
function resolveGoogleApplicationCredentials(): void {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!gac) return
  const abs = path.isAbsolute(gac) ? gac : path.resolve(process.cwd(), gac)
  if (!fs.existsSync(abs)) {
    throw new Error(
      `[firebase-admin] GOOGLE_APPLICATION_CREDENTIALS file not found:\n  ${abs}\n` +
        `(process.cwd(): ${process.cwd()})`
    )
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = abs
}

function readProjectIdFromServiceAccountFile(): string | undefined {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!gac) return undefined
  try {
    const j = JSON.parse(fs.readFileSync(gac, 'utf8')) as { project_id?: string }
    return j.project_id?.trim()
  } catch {
    return undefined
  }
}

resolveGoogleApplicationCredentials()

const hasServiceAccountJson = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim())
const projectIdFromJson = hasServiceAccountJson ? readProjectIdFromServiceAccountFile() : undefined

if (hasServiceAccountJson && !projectIdFromJson) {
  throw new Error(
    '[firebase-admin] Service account JSON has no valid project_id — check GOOGLE_APPLICATION_CREDENTIALS points to Firebase service account JSON'
  )
}

const resolvedProjectId =
  projectIdFromJson ??
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ??
  process.env.FIREBASE_PROJECT_ID?.trim()

function credential() {
  if (hasServiceAccountJson) {
    const json = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8'))
    return cert(json)
  }
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  })
}

const adminApp =
  getApps().find((a) => a.name === 'admin') ??
  initializeApp(
    {
      credential: credential(),
      ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
    },
    'admin'
  )

/** Named DB in Firebase (not `(default)`). Matches Firestore “Database ID” in console, e.g. aligncore-db */
const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)'

export const adminDb = getFirestore(adminApp, firestoreDatabaseId)

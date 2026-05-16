'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || '(default)'

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  firestoreDatabaseId === '(default)'
) {
  console.warn(
    '[AlignCore] NEXT_PUBLIC_FIRESTORE_DATABASE_ID is unset — using Firestore database "(default)". ' +
      'If mentors/companies never appear after saving via the API, set NEXT_PUBLIC_FIRESTORE_DATABASE_ID ' +
      'to match FIRESTORE_DATABASE_ID in aligncore-be/.env (see .env.local.example).'
  )
}

export const db = getFirestore(app, firestoreDatabaseId)

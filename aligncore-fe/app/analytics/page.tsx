'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Company, Mentor, RelationshipEntity } from '@/lib/types'
import EcosystemAnalytics from '@/components/analytics/EcosystemAnalytics'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function AnalyticsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [relationships, setRelationships] = useState<RelationshipEntity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'companies'), (snap) => {
        setCompanies(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Company)))
      }),
      onSnapshot(collection(db, 'mentors'), (snap) => {
        setMentors(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Mentor)))
      }),
      onSnapshot(collection(db, 'relationships'), (snap) => {
        setRelationships(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as RelationshipEntity)))
        setLoading(false)
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">Ecosystem analytics</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Live charts built from companies, mentors, and relationships — industry mix, health, lifecycle, workload,
          knowledge uploads, and WhatsApp sentiment snapshots.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-16">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading ecosystem data…
        </div>
      ) : (
        <EcosystemAnalytics companies={companies} mentors={mentors} relationships={relationships} />
      )}
    </div>
  )
}

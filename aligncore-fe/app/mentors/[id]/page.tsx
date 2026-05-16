'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  collectionGroup,
} from 'firebase/firestore'
import type { Mentor, RelationshipEntity, HealthHistory } from '@/lib/types'
import RelationshipCard from '@/components/RelationshipCard'
import { Users, ArrowLeft, Briefcase, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function MentorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [relationships, setRelationships] = useState<RelationshipEntity[]>([])
  const [historyMap, setHistoryMap] = useState<Record<string, HealthHistory[]>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'mentors', id)).then((snap) => {
      if (!snap.exists()) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setMentor({ id: snap.id, ...snap.data() } as Mentor)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'relationships'), where('mentor_id', '==', id))
    const unsub = onSnapshot(q, (snap) => {
      setRelationships(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RelationshipEntity)))
    })
    return unsub
  }, [id])

  useEffect(() => {
    const q = query(collectionGroup(db, 'history'))
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, HealthHistory[]> = {}
      snap.docs.forEach((d) => {
        const reId = d.ref.parent.parent?.id
        if (!reId) return
        if (!map[reId]) map[reId] = []
        map[reId].push({ id: d.id, ...d.data() } as HealthHistory)
      })
      setHistoryMap(map)
    })
    return unsub
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-20">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    )
  }

  if (notFound || !mentor) {
    return (
      <div className="py-20 text-center text-slate-500">
        <p className="text-base mb-3">Mentor not found.</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-400 hover:underline">
          Go back
        </button>
      </div>
    )
  }

  const avgHealth =
    relationships.length > 0
      ? relationships.reduce((sum, r) => sum + (r.engagement?.health_score ?? 0), 0) /
        relationships.length
      : null

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/mentors"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Mentors
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex-shrink-0">
            <Users className="w-7 h-7 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-100">{mentor.name}</h1>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${mentor.available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}
              >
                {mentor.available ? 'Available' : 'Busy'}
              </span>
            </div>
            {mentor.industry && (
              <p className="flex items-center gap-1 text-sm text-indigo-400 mt-1">
                <Briefcase className="w-3.5 h-3.5" /> {mentor.industry}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-100">{relationships.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Companies Mentored</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-100">
            {avgHealth !== null ? `${Math.round(avgHealth * 100)}` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Avg Health Score</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-100">
            {relationships.reduce((s, r) => s + (r.engagement?.sessions_completed ?? 0), 0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Sessions Completed</p>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bio</p>
        <p className="text-sm text-slate-300 leading-relaxed">{mentor.bio}</p>
      </div>

      {/* Expertise */}
      {mentor.expertise?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Expertise</p>
          <div className="flex flex-wrap gap-2">
            {mentor.expertise.map((e) => (
              <span
                key={e}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 rounded-lg"
              >
                <CheckCircle2 className="w-3 h-3" /> {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio — mentored companies */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Mentored Companies ({relationships.length})
        </h2>
        {relationships.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-600 text-sm">
            No mentoring relationships yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {relationships.map((re) => (
              <RelationshipCard key={re.id} re={re} history={historyMap[re.id] ?? []} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
  limit,
  onSnapshot,
  collectionGroup,
} from 'firebase/firestore'
import type { Company, RelationshipEntity, HealthHistory } from '@/lib/types'
import RelationshipCard from '@/components/RelationshipCard'
import HealthSparkline from '@/components/HealthSparkline'
import { LifecycleBadge } from '@/components/StatusBadge'
import {
  Building2,
  ArrowLeft,
  TrendingUp,
  Users,
  Target,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [company, setCompany] = useState<Company | null>(null)
  const [relationships, setRelationships] = useState<RelationshipEntity[]>([])
  const [peers, setPeers] = useState<Company[]>([])
  const [historyMap, setHistoryMap] = useState<Record<string, HealthHistory[]>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'companies', id)).then((snap) => {
      if (!snap.exists()) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const data = { id: snap.id, ...snap.data() } as Company
      setCompany(data)
      setLoading(false)

      // Load peer companies (same industry, excluding self)
      if (data.industry) {
        const peersQ = query(
          collection(db, 'companies'),
          where('industry', '==', data.industry),
          limit(7)
        )
        onSnapshot(peersQ, (pSnap) => {
          setPeers(
            pSnap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Company))
              .filter((c) => c.id !== id)
              .slice(0, 6)
          )
        })
      }
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'relationships'), where('company_id', '==', id))
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

  if (notFound || !company) {
    return (
      <div className="py-20 text-center text-slate-500">
        <p className="text-base mb-3">Company not found.</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-400 hover:underline">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Companies
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex-shrink-0">
            <Building2 className="w-7 h-7 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-100">{company.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-sm text-violet-400">
                <TrendingUp className="w-3.5 h-3.5" /> {company.industry}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300">
                {company.stage}
              </span>
              {company.size && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Users className="w-3 h-3" /> {company.size} people
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {company.problem && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Problem</p>
            <p className="text-sm text-slate-300">{company.problem}</p>
          </div>
        )}
        {company.goals && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Target className="w-3.5 h-3.5 inline mr-1" />
              Goals
            </p>
            <p className="text-sm text-slate-300">{company.goals}</p>
          </div>
        )}
      </div>

      {/* Relationships */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Mentor Relationships ({relationships.length})
        </h2>
        {relationships.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-600 text-sm">
            No mentor relationships yet.{' '}
            <Link href="/match" className="text-indigo-400 hover:underline">
              Match a mentor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {relationships.map((re) => (
              <RelationshipCard key={re.id} re={re} history={historyMap[re.id] ?? []} />
            ))}
          </div>
        )}
      </div>

      {/* Peer Companies */}
      {peers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Peer Companies in {company.industry}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {peers.map((peer) => (
              <Link key={peer.id} href={`/companies/${peer.id}`}>
                <div className="bg-slate-800/50 border border-slate-700/40 hover:border-violet-500/40 rounded-xl p-3 transition-all cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-200 truncate">{peer.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{peer.stage}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

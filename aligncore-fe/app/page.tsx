'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  onSnapshot,
  query,
  collectionGroup,
  QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { RelationshipEntity, HealthHistory } from '@/lib/types'
import RelationshipCard from '@/components/RelationshipCard'
import { demoPositive, demoNegative, demoReset } from '@/lib/api'
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Plus,
  Loader2,
  Network,
} from 'lucide-react'
import Link from 'next/link'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [relationships, setRelationships] = useState<RelationshipEntity[]>([])
  const [historyMap, setHistoryMap] = useState<Record<string, HealthHistory[]>>({})
  const [loading, setLoading] = useState(true)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'relationships'), (snap) => {
      setRelationships(
        snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as RelationshipEntity))
      )
      setLoading(false)
    })
    return unsub
  }, [])

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

  async function runDemo(type: 'positive' | 'negative' | 'reset') {
    setDemoLoading(type)
    try {
      if (type === 'positive') await demoPositive()
      else if (type === 'negative') await demoNegative()
      else await demoReset()
    } catch {
      /* noop */
    } finally {
      setDemoLoading(null)
    }
  }

  const atRisk = relationships.filter((r) => r.lifecycle === 'AT_RISK' || (r.engagement?.health_score ?? 1) < 0.4)
  const active = relationships.filter((r) => r.lifecycle === 'ACTIVE')
  const avgHealth =
    relationships.length > 0
      ? relationships.reduce((sum, r) => sum + (r.engagement?.health_score ?? 0), 0) / relationships.length
      : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ecosystem relationship overview</p>
        </div>
        <Link
          href="/match"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
        >
          <Plus className="w-4 h-4" /> New Relationship
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total REs"
          value={relationships.length}
          sub="relationships"
          icon={Network}
          accent="bg-indigo-600/20 text-indigo-400"
        />
        <StatCard
          label="Active"
          value={active.length}
          sub="ongoing"
          icon={Activity}
          accent="bg-emerald-600/20 text-emerald-400"
        />
        <StatCard
          label="At Risk"
          value={atRisk.length}
          sub="need attention"
          icon={AlertTriangle}
          accent="bg-rose-600/20 text-rose-400"
        />
        <StatCard
          label="Avg Health"
          value={`${Math.round(avgHealth * 100)}`}
          sub="/ 100"
          icon={TrendingUp}
          accent="bg-amber-600/20 text-amber-400"
        />
      </div>

      {/* Demo Controls */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Demo Simulation</p>
        <div className="flex flex-wrap gap-2">
          {[
            { type: 'positive' as const, label: 'Positive Signal', icon: ThumbsUp, cls: 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border-emerald-600/30' },
            { type: 'negative' as const, label: 'Negative Signal', icon: ThumbsDown, cls: 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border-rose-600/30' },
            { type: 'reset' as const, label: 'Reset', icon: RefreshCw, cls: 'bg-slate-600/20 text-slate-400 hover:bg-slate-600/30 border-slate-600/30' },
          ].map(({ type, label, icon: Icon, cls }) => (
            <button
              key={type}
              onClick={() => runDemo(type)}
              disabled={!!demoLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-50 ${cls}`}
            >
              {demoLoading === type ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Relationship Cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading relationships…
        </div>
      ) : relationships.length === 0 ? (
        <div className="text-center py-24 text-slate-600">
          <Network className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium text-slate-500">No relationships yet</p>
          <p className="text-sm mt-1 mb-5">Use AI Match to create your first mentor-company relationship.</p>
          <Link
            href="/match"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Start Matching
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {relationships.map((re) => (
            <RelationshipCard
              key={re.id}
              re={re}
              history={historyMap[re.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}

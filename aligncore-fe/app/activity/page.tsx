'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { ActivityEntry } from '../../lib/types'
import {
  Building2,
  Users,
  Network,
  MessageSquare,
  Activity,
} from 'lucide-react'

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

const ENTITY_STYLE: Record<string, { border: string; icon: React.ReactNode }> = {
  company: {
    border: 'border-violet-500/50',
    icon: <Building2 className="w-4 h-4 text-violet-400" />,
  },
  mentor: {
    border: 'border-indigo-500/50',
    icon: <Users className="w-4 h-4 text-indigo-400" />,
  },
  relationship: {
    border: 'border-emerald-500/50',
    icon: <Network className="w-4 h-4 text-emerald-400" />,
  },
  onboarding: {
    border: 'border-amber-500/50',
    icon: <MessageSquare className="w-4 h-4 text-amber-400" />,
  },
  system: {
    border: 'border-slate-600/50',
    icon: <Activity className="w-4 h-4 text-slate-400" />,
  },
}

const TYPE_LABEL: Record<string, string> = {
  COMPANY_CREATED: 'Company Created',
  MENTOR_CREATED: 'Mentor Added',
  RELATIONSHIP_CREATED: 'Relationship Created',
  HEALTH_UPDATED: 'Health Updated',
  SUMMARY_GENERATED: 'AI Summary',
  ONBOARDING_COMPLETE: 'Onboarding Complete',
  LIFECYCLE_CHANGED: 'Status Changed',
  CSV_IMPORT: 'CSV Import',
  AI_EXTRACT: 'AI Extraction',
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'activity_log'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityEntry, 'id'>) }))
      )
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Activity Feed</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time event log — last 50 events</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <span className="animate-pulse">Loading events…</span>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-500 text-sm">
          No activity yet. Create a company, mentor, or relationship to see events here.
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const style = ENTITY_STYLE[entry.entity_type] ?? ENTITY_STYLE.system
          return (
            <div
              key={entry.id}
              className={`flex items-start gap-3 rounded-xl border bg-slate-900/60 px-4 py-3 ${style.border}`}
            >
              <div className="mt-0.5 flex-shrink-0">{style.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    {TYPE_LABEL[entry.type] ?? entry.type}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-sm font-medium text-slate-200 truncate">{entry.entity_name}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{entry.detail}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-slate-600 whitespace-nowrap">
                {relativeTime(entry.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

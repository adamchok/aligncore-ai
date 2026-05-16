'use client'

import { useState } from 'react'
import { Users, MessageCircle, Brain, ChevronDown, RefreshCw, Pencil } from 'lucide-react'
import HealthScore from './HealthScore'
import HealthSparkline from './HealthSparkline'
import { LifecycleBadge, SentimentBadge } from './StatusBadge'
import type { RelationshipEntity, LifecycleState, HealthHistory } from '@/lib/types'
import { updateRelationshipLifecycle, generateSummary } from '@/lib/api'
import { RelationshipEditModal } from './RelationshipEditModal'

const LIFECYCLE_OPTIONS: LifecycleState[] = ['ACTIVE', 'AT_RISK', 'PAUSED', 'COMPLETED', 'DROPPED']

interface Props {
  re: RelationshipEntity
  history?: HealthHistory[]
}

export default function RelationshipCard({ re, history = [] }: Props) {
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryFailed, setSummaryFailed] = useState(false)
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false)
  const [showLifecycleMenu, setShowLifecycleMenu] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const healthScore = re.engagement?.health_score ?? 0

  async function handleGenerateSummary() {
    setSummaryFailed(false)
    setLoadingSummary(true)
    try {
      await generateSummary(re.id)
    } catch {
      setSummaryFailed(true)
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleLifecycleChange(next: LifecycleState) {
    setShowLifecycleMenu(false)
    if (next === re.lifecycle) return
    setUpdatingLifecycle(true)
    try {
      await updateRelationshipLifecycle(re.id, next)
    } catch {
      /* snapshot stays authoritative */
    } finally {
      setUpdatingLifecycle(false)
    }
  }

  const lastSentiment = re.comms?.last_sentiment

  const aiSummary = re.ai_summary?.trim()

  return (
    <div className="group relative bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/70 hover:bg-slate-800/80 transition-all duration-200 shadow-xl shadow-black/20">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-100 truncate">
              {re.company_name ?? re.company_id}
            </h3>
            <LifecycleBadge state={re.lifecycle} />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Users className="w-3 h-3 text-slate-500" />
            <p className="text-xs text-slate-400">{re.mentor_name ?? re.mentor_id}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-2 text-slate-500 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
            aria-label="Edit relationship"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <HealthScore score={healthScore} size={64} />
        </div>
      </div>

      {re.notes?.trim() ? (
        <div className="mb-3 rounded-xl border border-slate-700/40 bg-slate-900/35 px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{re.notes.trim()}</p>
        </div>
      ) : null}

      {/* Sparkline */}
      {history.length >= 2 && (
        <div className="mb-3">
          <HealthSparkline history={history} width={200} height={28} />
        </div>
      )}

      {/* Comms */}
      {re.comms?.last_message_preview && (
        <div className="mb-3 flex items-start gap-2 bg-slate-900/50 rounded-xl px-3 py-2.5 border border-slate-700/40">
          <MessageCircle className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {re.comms.last_message_preview}
            </p>
            {lastSentiment && (
              <div className="mt-1.5">
                <SentimentBadge sentiment={lastSentiment} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div className="mb-4">
        {aiSummary ? (
          <div className="bg-indigo-950/40 border border-indigo-700/30 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">AI Summary</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{aiSummary}</p>
          </div>
        ) : summaryFailed ? (
          <p className="text-xs text-rose-400">Failed to generate summary.</p>
        ) : (
          <button
            onClick={handleGenerateSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
          >
            {loadingSummary ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Brain className="w-3 h-3" />
            )}
            {loadingSummary ? 'Generating…' : 'Generate AI Summary'}
          </button>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-end">
        <div className="relative">
          <button
            onClick={() => setShowLifecycleMenu((v) => !v)}
            disabled={updatingLifecycle}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            {updatingLifecycle ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <span>Change status</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>

          {showLifecycleMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowLifecycleMenu(false)} />
              <div className="absolute right-0 bottom-full mb-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-20 min-w-[140px]">
                {LIFECYCLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleLifecycleChange(opt)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${
                      opt === re.lifecycle ? 'text-indigo-300 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {opt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {editOpen ? (
        <RelationshipEditModal key={re.id} onClose={() => setEditOpen(false)} relationship={re} />
      ) : null}
    </div>
  )
}

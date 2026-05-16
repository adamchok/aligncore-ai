import type { LifecycleState, Sentiment } from '@/lib/types'

const LIFECYCLE_STYLES: Record<LifecycleState, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  AT_RISK: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  PAUSED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  COMPLETED: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  DROPPED: 'bg-zinc-500/15 text-zinc-500 border-zinc-600/30',
}

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  POSITIVE: 'bg-emerald-500/10 text-emerald-400',
  NEUTRAL: 'bg-slate-500/10 text-slate-400',
  NEGATIVE: 'bg-rose-500/10 text-rose-400',
}

const SENTIMENT_DOTS: Record<Sentiment, string> = {
  POSITIVE: 'bg-emerald-400',
  NEUTRAL: 'bg-slate-400',
  NEGATIVE: 'bg-rose-400',
}

export function LifecycleBadge({ state }: { state: LifecycleState }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${LIFECYCLE_STYLES[state]}`}
    >
      {state.replace('_', ' ')}
    </span>
  )
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium ${SENTIMENT_STYLES[sentiment]}`}>
      <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${SENTIMENT_DOTS[sentiment]}`} />
      {sentiment}
    </span>
  )
}

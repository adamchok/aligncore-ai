'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import {
  Mail,
  CheckCircle,
  MessageSquare,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Tag,
  Bell,
} from 'lucide-react'

interface EmailLog {
  id: string
  from: string
  subject: string
  body_preview: string
  classification: 'ONBOARDING' | 'QNA' | 'OTHER'
  action: string
  reply_sent: boolean
  wa_notified: boolean
  company_id: string | null
  processed_at: string
  error: string | null
}

const BE = process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:4000'

const CLASSIFICATION_STYLE: Record<string, { label: string; color: string; Icon: typeof Mail }> = {
  ONBOARDING: { label: 'Onboarding', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: Building2 },
  QNA: { label: 'Q&A', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', Icon: MessageSquare },
  OTHER: { label: 'Other', color: 'text-slate-400 bg-slate-700/40 border-slate-700/50', Icon: Tag },
}

function ClassificationBadge({ type }: { type: string }) {
  const s = CLASSIFICATION_STYLE[type] ?? CLASSIFICATION_STYLE.OTHER
  const Icon = s.Icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  )
}

export default function GmailInboxPage() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState<{ processed: number } | null>(null)
  const [processError, setProcessError] = useState<string | null>(null)
  const [watching, setWatching] = useState(false)
  const [watchResult, setWatchResult] = useState<string | null>(null)
  const [watchError, setWatchError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, 'email_logs'),
      orderBy('processed_at', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmailLog)))
        setLogsLoading(false)
      },
      () => setLogsLoading(false),
    )
    return unsub
  }, [])

  async function handleWatch() {
    setWatching(true)
    setWatchResult(null)
    setWatchError(null)
    try {
      const res = await fetch(`${BE}/api/gmail/watch`, { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; historyId?: string; expiration?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const exp = data.expiration ? new Date(Number(data.expiration)).toLocaleString() : ''
      setWatchResult(`Webhook registered${exp ? ` — expires ${exp}` : ''}.`)
    } catch (e) {
      setWatchError((e as Error).message)
    } finally {
      setWatching(false)
    }
  }

  async function handleProcess() {
    setProcessing(true)
    setProcessResult(null)
    setProcessError(null)
    try {
      const res = await fetch(`${BE}/api/gmail/process`, { method: 'POST' })
      const data = (await res.json()) as { processed: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setProcessResult({ processed: data.processed })
    } catch (e) {
      setProcessError((e as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  const stats = {
    total: logs.length,
    onboarding: logs.filter((l) => l.classification === 'ONBOARDING').length,
    qna: logs.filter((l) => l.classification === 'QNA').length,
    errors: logs.filter((l) => !!l.error).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-6 h-6 text-violet-400" />
            Gmail AI Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Classifies incoming emails, extracts company profiles, and auto-replies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleWatch()}
            disabled={watching}
            title="Register Pub/Sub webhook — re-run every 7 days"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-2 text-sm font-medium text-slate-300 transition-colors"
          >
            {watching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {watching ? 'Registering…' : 'Register Webhook'}
          </button>
          <button
            onClick={() => void handleProcess()}
            disabled={processing}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {processing ? 'Processing…' : 'Check Inbox'}
          </button>
        </div>
      </div>

      {/* Feedback banners */}
      {watchResult && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
          {watchResult}
        </div>
      )}
      {watchError && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          Webhook: {watchError}
        </div>
      )}
      {processResult && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
          {processResult.processed === 0
            ? 'No new emails to process — inbox is up to date.'
            : `Processed ${processResult.processed} new email${processResult.processed === 1 ? '' : 's'}.`}
        </div>
      )}
      {processError && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {processError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Processed', value: stats.total, color: 'text-slate-200' },
          { label: 'Onboarding', value: stats.onboarding, color: 'text-emerald-400' },
          { label: 'Q&A', value: stats.qna, color: 'text-violet-400' },
          { label: 'Errors', value: stats.errors, color: 'text-rose-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Processed Emails
        </h2>

        {logsLoading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-12">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-600 text-sm">
            No emails processed yet. Click &ldquo;Check Inbox&rdquo; to start.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-2"
              >
                {/* Top row */}
                <div className="flex items-start gap-3 justify-between flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <ClassificationBadge type={log.classification} />
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {log.subject || '(no subject)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {log.reply_sent && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> replied
                      </span>
                    )}
                    {log.wa_notified && (
                      <span className="flex items-center gap-1 text-xs text-violet-400">
                        <MessageSquare className="w-3 h-3" /> WA notified
                      </span>
                    )}
                    {log.error && (
                      <span className="flex items-center gap-1 text-xs text-rose-400">
                        <AlertCircle className="w-3 h-3" /> error
                      </span>
                    )}
                  </div>
                </div>

                {/* From */}
                <p className="text-xs text-slate-500 truncate">{log.from}</p>

                {/* Body preview */}
                {log.body_preview && (
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {log.body_preview}
                  </p>
                )}

                {/* Action + timestamp */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-slate-600">{log.action}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(log.processed_at).toLocaleString()}
                  </p>
                </div>

                {/* Error detail */}
                {log.error && (
                  <p className="text-xs text-rose-400 bg-rose-500/5 rounded-lg px-3 py-2 leading-relaxed">
                    {log.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { RelationshipEntity, Mentor, Company, LifecycleState } from '@/lib/types'
import {
  patchRelationship,
  deleteRelationship,
  getRelationship,
  wahaListGroupChats,
  type WahaGroupChat,
} from '@/lib/api'
import { X, Loader2, Trash2, RefreshCw } from 'lucide-react'

const LIFECYCLE_OPTIONS: LifecycleState[] = ['ACTIVE', 'AT_RISK', 'PAUSED', 'COMPLETED', 'DROPPED']

export interface RelationshipEditModalProps {
  onClose: () => void
  relationship: RelationshipEntity
  onDeleted?: () => void
}

export function RelationshipEditModal({ onClose, relationship: re, onDeleted }: RelationshipEditModalProps) {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [wahaGroups, setWahaGroups] = useState<WahaGroupChat[]>([])
  const [wahaGroupsHint, setWahaGroupsHint] = useState<string | null>(null)
  /** True while loading fresh relationship doc + WAHA group list for this open. */
  const [refreshingOpenData, setRefreshingOpenData] = useState(true)

  const [mentorId, setMentorId] = useState(() => re.mentor_id)
  const [companyId, setCompanyId] = useState(() => re.company_id)
  const [lifecycle, setLifecycle] = useState<LifecycleState>(() => re.lifecycle)
  const [notes, setNotes] = useState(() => re.notes ?? '')
  const [waGroup, setWaGroup] = useState(() => re.wa_group_id ?? '')
  const [mentorPhone, setMentorPhone] = useState(() => re.mentor_phone ?? '')
  const [companyPhone, setCompanyPhone] = useState(() => re.company_phone ?? '')
  const [matchPct, setMatchPct] = useState(() =>
    re.match_score != null && Number.isFinite(re.match_score) ? String(Math.round(re.match_score * 100)) : ''
  )
  const [matchReasoning, setMatchReasoning] = useState(() => re.match_reasoning ?? '')

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function applyRelationshipSnapshot(r: RelationshipEntity) {
    setMentorId(r.mentor_id)
    setCompanyId(r.company_id)
    setLifecycle(r.lifecycle)
    setNotes(r.notes ?? '')
    setWaGroup(r.wa_group_id ?? '')
    setMentorPhone(r.mentor_phone ?? '')
    setCompanyPhone(r.company_phone ?? '')
    setMatchPct(
      r.match_score != null && Number.isFinite(r.match_score) ? String(Math.round(r.match_score * 100)) : ''
    )
    setMatchReasoning(r.match_reasoning ?? '')
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setRefreshingOpenData(true)
      try {
        const [ms, cs] = await Promise.all([
          getDocs(query(collection(db, 'mentors'), orderBy('name'))),
          getDocs(query(collection(db, 'companies'), orderBy('name'))),
        ])
        if (cancelled) return
        setMentors(ms.docs.map((d) => ({ id: d.id, ...d.data() } as Mentor)))
        setCompanies(cs.docs.map((d) => ({ id: d.id, ...d.data() } as Company)))
      } catch {
        if (!cancelled) setErr('Could not load mentors or companies.')
      }

      try {
        const [fresh, waha] = await Promise.all([getRelationship(re.id), wahaListGroupChats()])
        if (cancelled) return
        applyRelationshipSnapshot(fresh.relationship)
        setWahaGroups(waha.groups ?? [])
        setWahaGroupsHint(waha.error ?? null)
      } catch {
        if (!cancelled) {
          setWahaGroupsHint('Could not refresh WhatsApp groups / relationship from the server.')
          try {
            const waha = await wahaListGroupChats()
            if (cancelled) return
            setWahaGroups(waha.groups ?? [])
            if (waha.error) setWahaGroupsHint(waha.error)
          } catch {
            /* keep hint above */
          }
        }
      } finally {
        if (!cancelled) setRefreshingOpenData(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [re.id])

  const waGroupTrimmed = waGroup.trim()
  const groupIdSet = useMemo(() => new Set(wahaGroups.map((g) => g.id)), [wahaGroups])
  const waSelectValue =
    waGroupTrimmed === '' ? '' : groupIdSet.has(waGroupTrimmed) ? waGroupTrimmed : '__custom__'

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const pct = matchPct.trim()
      let match_score: number | null = null
      if (pct !== '') {
        const n = Number(pct)
        if (!Number.isFinite(n)) throw new Error('Match score must be a number (0–100).')
        match_score = Math.min(100, Math.max(0, n)) / 100
      }

      await patchRelationship(re.id, {
        mentor_id: mentorId,
        company_id: companyId,
        lifecycle,
        notes: notes.trim() || null,
        wa_group_id: waGroup.trim() || null,
        mentor_phone: mentorPhone.trim(),
        company_phone: companyPhone.trim(),
        match_score,
        match_reasoning: matchReasoning.trim() || null,
        engagement: {
          health_score: re.engagement?.health_score ?? 0,
        },
      })
      onClose()
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        'Delete this relationship and all health history points? Linked WhatsApp metadata here will be removed from AlignCore (not from WhatsApp itself).'
      )
    )
      return
    setDeleting(true)
    setErr(null)
    try {
      await deleteRelationship(re.id)
      onDeleted?.()
      onClose()
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Edit relationship</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pairing & engagement on the left · notes & WhatsApp on the right
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-slate-800">
              {/* Left — pairing & tracking */}
              <div className="p-6 space-y-4 lg:pr-8">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pairing & tracking</p>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Mentor</span>
                  <select
                    value={mentorId}
                    onChange={(e) => setMentorId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Company</span>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Lifecycle</span>
                  <select
                    value={lifecycle}
                    onChange={(e) => setLifecycle(e.target.value as LifecycleState)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    {LIFECYCLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Match score (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={matchPct}
                    onChange={(e) => setMatchPct(e.target.value)}
                    placeholder="Leave empty for none"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Match reasoning</span>
                  <textarea
                    value={matchReasoning}
                    onChange={(e) => setMatchReasoning(e.target.value)}
                    rows={4}
                    className="mt-1 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                </label>
              </div>

              {/* Right — notes & WhatsApp */}
              <div className="p-6 space-y-4 lg:pl-8">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes & messaging</p>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Internal notes — cadence, context, offline conversations…"
                    className="mt-1 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40 min-h-[120px]"
                  />
                </label>

                <div className="block space-y-1">
                  <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                    WhatsApp group
                    {refreshingOpenData ? (
                      <RefreshCw className="w-3 h-3 text-slate-500 animate-spin shrink-0" aria-hidden />
                    ) : null}
                  </span>
                  <select
                    value={waSelectValue}
                    disabled={refreshingOpenData}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') setWaGroup('')
                      else if (v === '__custom__') setWaGroup('')
                      else setWaGroup(v)
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  >
                    <option value="">No group linked</option>
                    {wahaGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                    <option value="__custom__">Other… (paste group JID)</option>
                  </select>
                  {waSelectValue === '__custom__' ? (
                    <input
                      type="text"
                      value={waGroup}
                      onChange={(e) => setWaGroup(e.target.value)}
                      placeholder="e.g. 120363123456789012@g.us"
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    />
                  ) : null}
                  <p className="mt-1 text-[10px] text-slate-600 leading-snug">
                    Choose a group from your linked WAHA session, or paste a JID if it is not listed.
                  </p>
                  {wahaGroupsHint ? (
                    <p className="text-[10px] text-amber-500/90 leading-snug">{wahaGroupsHint}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Mentor phone</span>
                    <input
                      type="text"
                      value={mentorPhone}
                      onChange={(e) => setMentorPhone(e.target.value)}
                      placeholder="Digits — synced from profiles when empty"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600/40"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Company phone</span>
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="Digits — synced from profiles when empty"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600/40"
                    />
                  </label>
                </div>
              </div>
            </div>

            {err ? (
              <div className="px-6 pb-2">
                <p className="text-xs text-rose-400">{err}</p>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/95">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-900/60 bg-rose-950/25 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/45 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete relationship
            </button>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-violet-900/30 disabled:opacity-50 transition-colors min-w-[88px]"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

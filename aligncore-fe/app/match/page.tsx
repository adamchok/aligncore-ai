'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, QueryDocumentSnapshot, query, orderBy } from 'firebase/firestore'
import { matchMentors, createRelationship, MatchResult, CompanyProfile } from '@/lib/api'
import type { Company, RelationshipEntity, Mentor } from '@/lib/types'
import {
  Sparkles,
  Loader2,
  Star,
  Building2,
  ChevronRight,
  CheckCircle2,
  Brain,
  ChevronDown,
  Link2,
  UserCircle,
  X,
} from 'lucide-react'

const STAGE_OPTS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage']

// Lifecycle states that count as "actively mentored" (ineligible for a new match)
const ACTIVE_LIFECYCLES = new Set(['ACTIVE', 'AT_RISK', 'PAUSED'])

function MatchCard({
  match,
  rank,
  onCreateRE,
  companyName,
  creating,
  created,
}: {
  match: MatchResult
  rank: number
  onCreateRE: (match: MatchResult) => void
  companyName: string
  creating: boolean
  created: boolean
}) {
  const scorePercent = Math.round(match.ai_match_score * 100)
  const scoreColor =
    scorePercent >= 70 ? 'text-emerald-400' : scorePercent >= 50 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div
      className={`bg-slate-800/60 border rounded-2xl p-5 transition-all ${
        rank === 1 ? 'border-indigo-500/50 shadow-lg shadow-indigo-900/20' : 'border-slate-700/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {rank === 1 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 fill-amber-400" /> Best Match
            </span>
          )}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{scorePercent}%</div>
      </div>

      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-100">{match.name}</h3>
        {match.industry && <p className="text-xs text-indigo-400 mt-0.5">{match.industry}</p>}
      </div>

      <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-3">{match.bio}</p>

      {match.expertise?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {match.expertise.map((e) => (
            <span key={e} className="text-[10px] px-2 py-0.5 bg-slate-700/60 text-slate-400 rounded-md">
              {e}
            </span>
          ))}
        </div>
      )}

      {match.reasoning && (
        <div className="bg-indigo-950/40 border border-indigo-700/30 rounded-xl px-3 py-2.5 mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Brain className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">AI Reasoning</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{match.reasoning}</p>
        </div>
      )}

      <button
        onClick={() => onCreateRE(match)}
        disabled={creating || created}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          created
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
        }`}
      >
        {created ? (
          <><CheckCircle2 className="w-4 h-4" /> Relationship Created!</>
        ) : creating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
        ) : (
          <>Create Relationship <ChevronRight className="w-4 h-4" /></>
        )}
      </button>
      {companyName && !created && (
        <p className="text-center text-[10px] text-slate-600 mt-1.5">
          Pair {companyName} ↔ {match.name}
        </p>
      )}
    </div>
  )
}

const EMPTY_FORM: CompanyProfile & { company_id: string } = {
  company_id: '',
  name: '',
  industry: '',
  stage: '',
  about: '',
  problem: '',
  goals: '',
  mentor_expertise: '',
}

export default function MatchPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [relationships, setRelationships] = useState<RelationshipEntity[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')

  const [form, setForm] = useState(EMPTY_FORM)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set())

  const [directMentorId, setDirectMentorId] = useState('')
  const [directSaving, setDirectSaving] = useState(false)
  const [directErr, setDirectErr] = useState<string | null>(null)
  const [pairSuccessMsg, setPairSuccessMsg] = useState<string | null>(null)

  // Subscribe to companies + mentors + relationships
  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'companies'), (snap) =>
      setCompanies(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Company)))
    )
    const u2 = onSnapshot(collection(db, 'relationships'), (snap) =>
      setRelationships(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as RelationshipEntity)))
    )
    const u3 = onSnapshot(query(collection(db, 'mentors'), orderBy('name')), (snap) =>
      setMentors(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Mentor)))
    )
    return () => {
      u1()
      u2()
      u3()
    }
  }, [])

  useEffect(() => {
    if (!pairSuccessMsg) return
    const t = setTimeout(() => setPairSuccessMsg(null), 7000)
    return () => clearTimeout(t)
  }, [pairSuccessMsg])

  // Companies that are not currently in an active mentorship
  const busyCompanyIds = new Set(
    relationships.filter((r) => ACTIVE_LIFECYCLES.has(r.lifecycle)).map((r) => r.company_id)
  )
  const availableCompanies = companies
    .filter((c) => !busyCompanyIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  function handleSelectCompany(id: string) {
    setSelectedCompanyId(id)
    setDirectMentorId('')
    setDirectErr(null)
    if (!id) {
      setForm(EMPTY_FORM)
      return
    }
    const c = companies.find((co) => co.id === id)
    if (!c) return
    setForm({
      company_id: c.id,
      name: c.name,
      industry: c.industry ?? '',
      stage: c.stage ?? '',
      about: c.about ?? '',
      problem: c.problem ?? '',
      goals: c.goals ?? '',
      mentor_expertise: form.mentor_expertise, // keep existing expertise filter
    })
    setMatches([])
    setCreatedIds(new Set())
  }

  function clearSelection() {
    setSelectedCompanyId('')
    setForm(EMPTY_FORM)
    setMatches([])
    setCreatedIds(new Set())
    setDirectMentorId('')
    setDirectErr(null)
  }

  async function handleMatch() {
    if (!form.name.trim()) return
    setSearching(true)
    setError(null)
    setMatches([])
    try {
      const { matches: results } = await matchMentors({
        name: form.name,
        industry: form.industry,
        stage: form.stage,
        about: form.about,
        problem: form.problem,
        goals: form.goals,
        mentor_expertise: form.mentor_expertise,
      })
      setMatches(results)
    } catch (e) {
      setError(String(e))
    } finally {
      setSearching(false)
    }
  }

  async function handleCreateRE(match: MatchResult) {
    setCreatingId(match.id)
    try {
      await createRelationship({
        mentor_id: match.id,
        mentor_name: match.name,
        company_id: form.company_id || form.name.toLowerCase().replace(/\s+/g, '-'),
        company_name: form.name,
        match_score: match.ai_match_score,
        match_reasoning: match.reasoning,
      })
      setCreatedIds((prev) => new Set([...prev, match.id]))
    } catch {
      /* noop */
    } finally {
      setCreatingId(null)
    }
  }

  const mentorsAlreadyWithCompany = new Set(
    relationships
      .filter((r) => r.company_id === form.company_id && ACTIVE_LIFECYCLES.has(r.lifecycle))
      .map((r) => r.mentor_id)
  )
  const mentorsPickList = mentors.filter((m) => !mentorsAlreadyWithCompany.has(m.id))

  async function handleDirectPair() {
    if (!form.company_id?.trim() || !directMentorId) return
    setDirectSaving(true)
    setDirectErr(null)
    try {
      const mentor = mentors.find((m) => m.id === directMentorId)
      const company = companies.find((c) => c.id === form.company_id)
      await createRelationship({
        mentor_id: directMentorId,
        company_id: form.company_id,
        mentor_name: mentor?.name,
        company_name: company?.name ?? form.name,
      })
      const cn = company?.name ?? form.name
      const mn = mentor?.name ?? 'Mentor'
      setPairSuccessMsg(`Created relationship: ${cn} ↔ ${mn}`)
      clearSelection()
    } catch (e) {
      const msg = String(e)
      if (msg.includes('409')) setDirectErr('This mentor is already paired with that company.')
      else setDirectErr(msg)
    } finally {
      setDirectSaving(false)
    }
  }

  const selectedCompany = selectedCompanyId ? companies.find((c) => c.id === selectedCompanyId) : null

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Pair companies & mentors</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Link a mentor directly, or run AI matching when you want ranked suggestions.
        </p>
      </div>

      {pairSuccessMsg ? (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-600/40 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{pairSuccessMsg}</span>
        </div>
      ) : null}

      {/* Input panel */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-400" /> Company Profile
        </h2>

        {/* Company picker */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Select Company
            {availableCompanies.length > 0 && (
              <span className="ml-2 text-[10px] text-slate-600">
                {availableCompanies.length} without an active mentor
              </span>
            )}
          </label>

          {selectedCompany ? (
            // Selected state — compact chip
            <div className="flex items-center gap-3 bg-indigo-950/50 border border-indigo-500/30 rounded-xl px-4 py-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{selectedCompany.name}</p>
                <p className="text-[10px] text-indigo-400">
                  {selectedCompany.industry} · {selectedCompany.stage}
                </p>
              </div>
              <button
                onClick={clearSelection}
                className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            // Dropdown
            <div className="relative">
              <select
                value={selectedCompanyId}
                onChange={(e) => handleSelectCompany(e.target.value)}
                className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors pr-9"
              >
                <option value="">— fill in manually below —</option>
                {availableCompanies.length > 0 && (
                  <optgroup label="Companies without active mentor">
                    {availableCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}  ·  {c.industry}  ·  {c.stage}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableCompanies.length === 0 && companies.length > 0 && (
                  <option disabled value="">All companies already have an active mentor</option>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Direct pairing — requires a saved company id */}
        {form.company_id ? (
          <div className="mb-6 rounded-2xl border border-emerald-600/35 bg-emerald-950/25 px-5 py-4">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5" />
              Pair without AI
            </h3>
            <p className="text-[11px] text-slate-500 mb-3 leading-snug">
              Creates an active relationship immediately with no AI score or reasoning — useful when you already know the pairing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="block flex-1 min-w-0">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Mentor</span>
                <select
                  value={directMentorId}
                  onChange={(e) => {
                    setDirectMentorId(e.target.value)
                    setDirectErr(null)
                  }}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 transition-colors"
                >
                  <option value="">Choose mentor…</option>
                  {mentorsPickList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.industry ? ` · ${m.industry}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleDirectPair}
                disabled={directSaving || !directMentorId || mentorsPickList.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors shrink-0"
              >
                {directSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <UserCircle className="w-4 h-4" /> Create relationship
                  </>
                )}
              </button>
            </div>
            {mentorsPickList.length === 0 && mentors.length > 0 ? (
              <p className="mt-2 text-[11px] text-amber-500/90">
                Every mentor already has an active relationship with this company (or none left to choose).
              </p>
            ) : null}
            {directErr ? <p className="mt-2 text-xs text-rose-400">{directErr}</p> : null}
          </div>
        ) : selectedCompanyId === '' && companies.length > 0 ? (
          <p className="mb-6 text-[11px] text-slate-600 leading-snug flex items-start gap-2">
            <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            Select a company above (saved profile) to enable direct pairing without AI.
          </p>
        ) : null}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-700/60" />
          <span className="text-[10px] text-slate-600 uppercase tracking-wide">
            {selectedCompany ? 'edit profile below' : 'or fill manually'}
          </span>
          <div className="flex-1 h-px bg-slate-700/60" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Kopi Technologies"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry</label>
            <input
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="e.g. FinTech, HealthTech"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Stage</label>
            <select
              value={form.stage}
              onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Select stage…</option>
              {STAGE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Desired Mentor Expertise</label>
            <input
              value={form.mentor_expertise}
              onChange={(e) => setForm((f) => ({ ...f, mentor_expertise: e.target.value }))}
              placeholder="e.g. Fundraising, Growth"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">About the company</label>
            <textarea
              value={form.about ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
              rows={3}
              placeholder="What they build, who they serve, mission — broader context than the problem alone."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Problem / Challenge</label>
            <textarea
              value={form.problem}
              onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
              rows={2}
              placeholder="Describe the main problem or challenge…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Goals</label>
            <textarea
              value={form.goals}
              onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
              rows={2}
              placeholder="What does the company hope to gain from mentorship?"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleMatch}
          disabled={searching || !form.name.trim()}
          className="mt-5 flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
        >
          {searching ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Matching…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Find Best Mentors</>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-rose-950/40 border border-rose-700/30 rounded-xl px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {matches.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-300">AI mentor suggestions</h2>
            <span className="text-xs text-slate-600">optional · for {form.name}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                rank={m.rank}
                onCreateRE={handleCreateRE}
                companyName={form.name}
                creating={creatingId === m.id}
                created={createdIds.has(m.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

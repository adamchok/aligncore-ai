'use client'

import { useState } from 'react'
import { matchMentors, createRelationship, MatchResult, CompanyProfile } from '@/lib/api'
import {
  Sparkles,
  Loader2,
  Star,
  Building2,
  Users,
  ChevronRight,
  CheckCircle2,
  Brain,
} from 'lucide-react'

const STAGE_OPTS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage']

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
        {match.industry && (
          <p className="text-xs text-indigo-400 mt-0.5">{match.industry}</p>
        )}
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

export default function MatchPage() {
  const [form, setForm] = useState<CompanyProfile & { company_id: string }>({
    company_id: '',
    name: '',
    industry: '',
    stage: '',
    problem: '',
    goals: '',
    mentor_expertise: '',
  })

  const [matches, setMatches] = useState<MatchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set())

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

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">AI Match</h1>
        <p className="text-sm text-slate-500 mt-0.5">Find the best mentor for a startup using semantic AI matching</p>
      </div>

      {/* Input panel */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-400" /> Company Profile
        </h2>
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
            <Users className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-300">Top Mentor Matches</h2>
            <span className="text-xs text-slate-600">for {form.name}</span>
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

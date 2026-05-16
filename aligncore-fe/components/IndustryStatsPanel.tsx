'use client'

import type { Company, RelationshipEntity } from '../lib/types'

interface Props {
  companies: Company[]
  relationships: RelationshipEntity[]
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-5 text-right">{count}</span>
    </div>
  )
}

export default function IndustryStatsPanel({ companies, relationships }: Props) {
  if (companies.length === 0) return null

  // Industry counts
  const industryCounts: Record<string, number> = {}
  for (const c of companies) {
    const key = c.industry || 'Other'
    industryCounts[key] = (industryCounts[key] ?? 0) + 1
  }
  const industries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])
  const maxIndustry = industries[0]?.[1] ?? 1

  // Stage distribution
  const stageCounts: Record<string, number> = {}
  for (const c of companies) {
    const key = c.stage || 'Unknown'
    stageCounts[key] = (stageCounts[key] ?? 0) + 1
  }
  const stages = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])

  // Health distribution
  const green = relationships.filter((r) => (r.engagement?.health_score ?? 0) >= 0.7).length
  const amber = relationships.filter((r) => {
    const s = r.engagement?.health_score ?? 0
    return s >= 0.4 && s < 0.7
  }).length
  const red = relationships.filter((r) => (r.engagement?.health_score ?? 0) < 0.4).length

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 mb-8">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Ecosystem Breakdown</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Industry */}
        <div>
          <p className="text-xs text-slate-500 mb-2">By Industry</p>
          <div className="space-y-2">
            {industries.slice(0, 6).map(([name, count]) => (
              <Bar key={name} label={name} count={count} max={maxIndustry} />
            ))}
          </div>
        </div>

        {/* Stage */}
        <div>
          <p className="text-xs text-slate-500 mb-2">By Stage</p>
          <div className="flex flex-wrap gap-1.5">
            {stages.map(([stage, count]) => (
              <span
                key={stage}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/60 text-xs text-slate-300"
              >
                {stage}
                <span className="font-semibold text-indigo-400">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Health */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Relationship Health</p>
          {relationships.length === 0 ? (
            <p className="text-xs text-slate-600">No relationships yet</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 flex-1">Healthy (≥70)</span>
                <span className="text-xs font-semibold text-emerald-400">{green}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 flex-1">At Risk (40–69)</span>
                <span className="text-xs font-semibold text-amber-400">{amber}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 flex-1">Critical (&lt;40)</span>
                <span className="text-xs font-semibold text-rose-400">{red}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

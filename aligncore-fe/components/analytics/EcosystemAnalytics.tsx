'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { Building2, Users, Network, TrendingUp } from 'lucide-react'
import type { Company, Mentor, RelationshipEntity } from '@/lib/types'
import {
  industrySlicesForPie,
  countCompaniesByStage,
  relationshipHealthBuckets,
  relationshipLifecycleCounts,
  avgRelationshipHealthByCompanyIndustry,
  matchScoreBuckets,
  sentimentDistribution,
  topMentorsByRelationshipCount,
  relationshipsCreatedByMonth,
  knowledgeDocTotals,
  mentorAvailabilityCounts,
} from '@/lib/ecosystemAnalytics'

const PIE_PALETTE = ['#818cf8', '#34d399', '#38bdf8', '#fbbf24', '#fb7185', '#a78bfa', '#f472b6', '#94a3b8']

const tipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '10px',
  fontSize: '12px',
}

function ChartCard({
  title,
  subtitle,
  children,
  tall,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  tall?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 shadow-xl shadow-black/20">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500 mt-1 mb-4">{subtitle}</p> : <div className="mb-4" />}
      <div className={tall ? 'h-[320px] w-full min-h-[220px]' : 'h-[280px] w-full min-h-[200px]'}>{children}</div>
    </div>
  )
}

function EmptyInsight({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 px-4 text-center text-xs text-slate-500">
      {label}
    </div>
  )
}

function formatMonthShort(isoMonth: string): string {
  const [y, m] = isoMonth.split('-').map(Number)
  if (!y || !m) return isoMonth
  return new Date(y, m - 1).toLocaleDateString('en', { month: 'short', year: '2-digit' })
}

function pieTotal(rows: { value: number }[]): number {
  return rows.reduce((s, r) => s + r.value, 0)
}

interface Props {
  companies: Company[]
  mentors: Mentor[]
  relationships: RelationshipEntity[]
}

export default function EcosystemAnalytics({ companies, mentors, relationships }: Props) {
  const industryPie = useMemo(() => industrySlicesForPie(companies), [companies])
  const stageData = useMemo(() => countCompaniesByStage(companies), [companies])
  const healthPie = useMemo(() => relationshipHealthBuckets(relationships), [relationships])
  const lifecycleData = useMemo(() => relationshipLifecycleCounts(relationships), [relationships])
  const avgHealthIndustry = useMemo(
    () => avgRelationshipHealthByCompanyIndustry(relationships, companies),
    [relationships, companies]
  )
  const matchBuckets = useMemo(() => matchScoreBuckets(relationships), [relationships])
  const sentimentBars = useMemo(() => sentimentDistribution(relationships), [relationships])
  const mentorLoad = useMemo(() => topMentorsByRelationshipCount(relationships, mentors, 12), [relationships, mentors])
  const monthlyNewRe = useMemo(() => relationshipsCreatedByMonth(relationships), [relationships])
  const monthlyChartData = useMemo(
    () => monthlyNewRe.map((row) => ({ ...row, label: formatMonthShort(row.name) })),
    [monthlyNewRe]
  )
  const knowledge = useMemo(() => knowledgeDocTotals(companies, mentors), [companies, mentors])
  const mentorAvail = useMemo(() => mentorAvailabilityCounts(mentors), [mentors])

  const avgHealth =
    relationships.length > 0
      ? Math.round(
          (relationships.reduce((s, r) => s + (r.engagement?.health_score ?? 0), 0) / relationships.length) * 100
        )
      : null

  const activeRe = relationships.filter((r) => r.lifecycle === 'ACTIVE').length

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Companies</span>
            <Building2 className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{companies.length}</p>
          <p className="text-[11px] text-slate-600 mt-1">Registered startups</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Mentors</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{mentors.length}</p>
          <p className="text-[11px] text-slate-600 mt-1">
            {mentorAvail[0]?.value ?? 0} available · {mentorAvail[1]?.value ?? 0} unavailable
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Relationships</span>
            <Network className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{relationships.length}</p>
          <p className="text-[11px] text-slate-600 mt-1">{activeRe} active lifecycle</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Avg health</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{avgHealth !== null ? `${avgHealth}` : '—'}</p>
          <p className="text-[11px] text-slate-600 mt-1">{avgHealth !== null ? 'Across all relationships /100' : 'No relationships yet'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Companies by industry" subtitle="Portfolio concentration">
          {companies.length === 0 ? (
            <EmptyInsight label="Add companies to see industry distribution." />
          ) : pieTotal(industryPie) === 0 ? (
            <EmptyInsight label="No data." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={industryPie} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={52} outerRadius={88} paddingAngle={2}>
                  {industryPie.map((_, i) => (
                    <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} stroke="#1e293b" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Relationship health" subtitle="Current engagement scores">
          {relationships.length === 0 ? (
            <EmptyInsight label="Create relationships to visualize health buckets." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={healthPie} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={56} outerRadius={92} paddingAngle={2}>
                  {healthPie.map((entry, i) => (
                    <Cell key={i} fill={entry.fill ?? PIE_PALETTE[i]} stroke="#1e293b" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Companies by stage" subtitle="Funding / maturity mix">
          {stageData.length === 0 ? (
            <EmptyInsight label="No stage data yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="value" name="Companies" fill="#818cf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Relationship lifecycle" subtitle="Operational pipeline">
          {lifecycleData.length === 0 ? (
            <EmptyInsight label="No relationships yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={lifecycleData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={88} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="value" name="Relationships" fill="#38bdf8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="New relationships over time" subtitle="By creation month (latest months)" tall>
          {monthlyChartData.length === 0 ? (
            <EmptyInsight label="No dated relationships — creation timestamps appear after matches." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="reGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tipStyle} />
                <Area type="monotone" dataKey="value" name="Created" stroke="#a5b4fc" strokeWidth={2} fill="url(#reGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Avg relationship health by company industry" subtitle="Mean score ×100 where relationships exist">
          {avgHealthIndustry.length === 0 ? (
            <EmptyInsight label="Need relationships linked to companies with industries." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={avgHealthIndustry.slice(0, 12)} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="value" fill="#34d399" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="AI match scores" subtitle="Stored match_score on relationships">
          {relationships.length === 0 ? (
            <EmptyInsight label="No relationships yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matchBuckets} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="value" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Last WhatsApp sentiment" subtitle="From latest captured message preview pipeline">
          {relationships.length === 0 ? (
            <EmptyInsight label="No relationships yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentBars} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="value" fill="#64748b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Mentor workload" subtitle="Relationships per mentor (top 12)" tall>
          {mentorLoad.length === 0 ? (
            <EmptyInsight label="No relationships yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={mentorLoad} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={132} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="value" fill="#fb7185" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Knowledge documents" subtitle="Total uploads (denormalized counts on profiles)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'Company KB', value: knowledge.companyDocs },
                { name: 'Mentor KB', value: knowledge.mentorDocs },
              ]}
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Mentor availability" subtitle="Pool capacity snapshot">
          {mentors.length === 0 ? (
            <EmptyInsight label="Add mentors to see availability split." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mentorAvail} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={50} outerRadius={86} paddingAngle={2}>
                  <Cell fill="#34d399" stroke="#1e293b" strokeWidth={1} />
                  <Cell fill="#64748b" stroke="#1e293b" strokeWidth={1} />
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

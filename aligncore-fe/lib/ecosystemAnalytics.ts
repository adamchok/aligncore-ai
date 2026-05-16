import type { Company, Mentor, RelationshipEntity } from '@/lib/types'

export interface NamedCount {
  name: string
  value: number
}

export interface NamedValue extends NamedCount {
  fill?: string
}

function sortedEntries(counts: Record<string, number>): NamedCount[] {
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function countCompaniesByIndustry(companies: Company[]): NamedCount[] {
  const m: Record<string, number> = {}
  for (const c of companies) {
    const k = (c.industry ?? '').trim() || 'Unknown'
    m[k] = (m[k] ?? 0) + 1
  }
  return sortedEntries(m)
}

/** Pie slices: top N−1 industries + Other when needed */
export function industrySlicesForPie(companies: Company[], maxSlices = 8): NamedCount[] {
  const rows = countCompaniesByIndustry(companies)
  if (rows.length <= maxSlices) return rows
  const head = rows.slice(0, maxSlices - 1)
  const tailSum = rows.slice(maxSlices - 1).reduce((s, r) => s + r.value, 0)
  return [...head, { name: 'Other', value: tailSum }]
}

export function countCompaniesByStage(companies: Company[]): NamedCount[] {
  const m: Record<string, number> = {}
  for (const c of companies) {
    const k = (c.stage ?? '').trim() || 'Unknown'
    m[k] = (m[k] ?? 0) + 1
  }
  return sortedEntries(m)
}

export function relationshipHealthBuckets(relationships: RelationshipEntity[]): NamedValue[] {
  let healthy = 0
  let moderate = 0
  let critical = 0
  for (const r of relationships) {
    const s = r.engagement?.health_score ?? 0
    if (s >= 0.7) healthy++
    else if (s >= 0.4) moderate++
    else critical++
  }
  return [
    { name: 'Healthy (≥70)', value: healthy, fill: '#34d399' },
    { name: 'Watch (40–69)', value: moderate, fill: '#fbbf24' },
    { name: 'Critical (<40)', value: critical, fill: '#fb7185' },
  ]
}

export function relationshipLifecycleCounts(relationships: RelationshipEntity[]): NamedCount[] {
  const m: Record<string, number> = {}
  for (const r of relationships) {
    const k = r.lifecycle ?? 'UNKNOWN'
    m[k] = (m[k] ?? 0) + 1
  }
  return sortedEntries(m).map(({ name, value }) => ({
    name: name.replace('_', ' '),
    value,
  }))
}

export function avgRelationshipHealthByCompanyIndustry(
  relationships: RelationshipEntity[],
  companies: Company[]
): NamedCount[] {
  const industryOf = new Map(companies.map((c) => [c.id, (c.industry ?? '').trim() || 'Unknown']))
  const sums = new Map<string, number>()
  const counts = new Map<string, number>()
  for (const r of relationships) {
    const ind = industryOf.get(r.company_id) ?? 'Unknown'
    const h = r.engagement?.health_score ?? 0
    sums.set(ind, (sums.get(ind) ?? 0) + h)
    counts.set(ind, (counts.get(ind) ?? 0) + 1)
  }
  const out: NamedCount[] = []
  for (const [name, sum] of sums) {
    const n = counts.get(name) ?? 1
    out.push({ name, value: Math.round((sum / n) * 100) })
  }
  return out.sort((a, b) => b.value - a.value)
}

export function matchScoreBuckets(relationships: RelationshipEntity[]): NamedCount[] {
  let none = 0
  let low = 0
  let mid = 0
  let high = 0
  for (const r of relationships) {
    const ms = r.match_score
    if (ms == null || !Number.isFinite(ms)) {
      none++
      continue
    }
    if (ms < 0.5) low++
    else if (ms < 0.8) mid++
    else high++
  }
  return [
    { name: 'No / unknown score', value: none },
    { name: '< 50%', value: low },
    { name: '50–79%', value: mid },
    { name: '≥ 80%', value: high },
  ]
}

export function sentimentDistribution(relationships: RelationshipEntity[]): NamedCount[] {
  let positive = 0
  let neutral = 0
  let negative = 0
  let none = 0
  for (const r of relationships) {
    const s = r.comms?.last_sentiment
    if (!s) none++
    else if (s === 'POSITIVE') positive++
    else if (s === 'NEUTRAL') neutral++
    else if (s === 'NEGATIVE') negative++
    else none++
  }
  return [
    { name: 'Positive', value: positive },
    { name: 'Neutral', value: neutral },
    { name: 'Negative', value: negative },
    { name: 'No message yet', value: none },
  ]
}

export function topMentorsByRelationshipCount(
  relationships: RelationshipEntity[],
  mentors: Mentor[],
  limit = 10
): NamedCount[] {
  const names = new Map(mentors.map((m) => [m.id, m.name]))
  const counts = new Map<string, number>()
  for (const r of relationships) {
    counts.set(r.mentor_id, (counts.get(r.mentor_id) ?? 0) + 1)
    if (!names.has(r.mentor_id) && r.mentor_name?.trim()) {
      names.set(r.mentor_id, r.mentor_name.trim())
    }
  }
  return [...counts.entries()]
    .map(([id, value]) => ({ name: names.get(id) ?? `Mentor ${id.slice(0, 6)}…`, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export function relationshipsCreatedByMonth(relationships: RelationshipEntity[]): NamedCount[] {
  const m = new Map<string, number>()
  for (const r of relationships) {
    const raw = r.created_at
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  const keys = [...m.keys()].sort()
  const tail = keys.slice(-14)
  return tail.map((name) => ({ name, value: m.get(name) ?? 0 }))
}

export function knowledgeDocTotals(companies: Company[], mentors: Mentor[]): {
  companyDocs: number
  mentorDocs: number
} {
  const companyDocs = companies.reduce((s, c) => s + (c.knowledge_doc_count ?? 0), 0)
  const mentorDocs = mentors.reduce((s, m) => s + (m.knowledge_doc_count ?? 0), 0)
  return { companyDocs, mentorDocs }
}

export function mentorAvailabilityCounts(mentors: Mentor[]): NamedCount[] {
  let avail = 0
  let busy = 0
  for (const m of mentors) {
    if (m.available) avail++
    else busy++
  }
  return [
    { name: 'Available', value: avail },
    { name: 'Unavailable', value: busy },
  ]
}

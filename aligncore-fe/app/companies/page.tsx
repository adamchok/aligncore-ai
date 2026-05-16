'use client'

import { useState, useEffect, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, QueryDocumentSnapshot } from 'firebase/firestore'
import type { Company } from '@/lib/types'
import { createCompany, extractProfile, extractProfileFromDoc } from '@/lib/api'
import {
  Building2, Plus, X, Loader2, CheckCircle2, TrendingUp,
  Sparkles, Upload, AlignLeft, FileText,
} from 'lucide-react'
import Link from 'next/link'
import CSVImportModal from '@/components/CSVImportModal'

const STAGE_OPTS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage']
const INDUSTRY_OPTS = ['FinTech', 'HealthTech', 'EdTech', 'SaaS', 'E-Commerce', 'DeepTech', 'CleanTech', 'Other']

function CompanyCard({ company }: { company: Company }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600/70 transition-all cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex-shrink-0">
          <Building2 className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">{company.name}</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
              {company.stage}
            </span>
          </div>
          <p className="text-xs text-violet-400 mt-0.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {company.industry}
          </p>
          {company.problem && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{company.problem}</p>
          )}
          {company.goals && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">{company.goals}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  name: '',
  industry: '',
  /** When industry === "Other", stored value is taken from here */
  industry_custom: '',
  stage: '',
  problem: '',
  goals: '',
  size: '',
  whatsapp_number: '',
}

function resolveIndustry(form: typeof EMPTY_FORM): string {
  if (form.industry === 'Other') return form.industry_custom.trim()
  return form.industry
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Form
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // AI pre-fill (inside the same modal)
  const [aiTab, setAiTab] = useState<'text' | 'file'>('text')
  const [aiText, setAiText] = useState('')
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [aiFields, setAiFields] = useState<Set<string>>(new Set())

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Company)))
      setLoading(false)
    })
    return unsub
  }, [])

  function openModal() {
    setForm(EMPTY_FORM)
    setAiText('')
    setAiFile(null)
    setAiFields(new Set())
    setExtractError(null)
    setSaveError(null)
    setSaved(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
  }

  async function handleExtract() {
    setExtracting(true)
    setExtractError(null)
    try {
      let profile: { name: string; industry: string; stage: string; problem: string; goals: string; size: string }
      if (aiTab === 'text') {
        if (aiText.trim().length < 20) {
          setExtractError('Enter at least 20 characters.')
          return
        }
        const res = await extractProfile(aiText)
        profile = res.profile
      } else {
        if (!aiFile) {
          setExtractError('Select a file first.')
          return
        }
        const res = await extractProfileFromDoc(aiFile)
        profile = res.profile
      }

      const filled = new Set<string>()
      setForm((f) => {
        const next = { ...f }
        if (profile.name?.trim()) { next.name = profile.name.trim(); filled.add('name') }
        if (profile.industry?.trim()) {
          const ind = profile.industry.trim()
          const preset = INDUSTRY_OPTS.filter((o) => o !== 'Other')
          if (preset.includes(ind)) {
            next.industry = ind
            next.industry_custom = ''
          } else {
            next.industry = 'Other'
            next.industry_custom = ind
          }
          filled.add('industry')
        }
        if (profile.stage) { next.stage = profile.stage; filled.add('stage') }
        if (profile.problem?.trim()) { next.problem = profile.problem.trim(); filled.add('problem') }
        if (profile.goals?.trim()) { next.goals = profile.goals.trim(); filled.add('goals') }
        if (profile.size?.trim()) { next.size = profile.size.trim(); filled.add('size') }
        return next
      })
      setAiFields(filled)
    } catch (e) {
      const msg = (e as Error).message.replace(/^API \w+ [^ ]+ → \d+: /, '')
      setExtractError(msg || 'Extraction failed — please try again.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    const industry = resolveIndustry(form)
    if (!form.name.trim() || !industry || !form.stage) return
    setSaving(true)
    setSaveError(null)
    try {
      await createCompany({
        name: form.name.trim(),
        industry,
        stage: form.stage,
        problem: form.problem.trim(),
        goals: form.goals.trim(),
        size: form.size.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
      })
      setSaved(true)
      setTimeout(() => closeModal(), 1200)
    } catch (e) {
      setSaveError('Failed to save. Please try again.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function labelWithAI(label: string, field: string) {
    return (
      <span className="flex items-center gap-1.5">
        {label}
        {aiFields.has(field) && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
            AI
          </span>
        )}
      </span>
    )
  }

  const canExtract = aiTab === 'text' ? aiText.trim().length >= 20 : aiFile !== null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'} registered
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-xl transition-colors"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-violet-900/40"
          >
            <Plus className="w-4 h-4" /> Add Company
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No companies yet. Add your first startup.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((c) => (
            <Link key={c.id} href={`/companies/${c.id}`}>
              <CompanyCard company={c} />
            </Link>
          ))}
        </div>
      )}

      {/* CSV Import */}
      {showImport && (
        <CSVImportModal onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />
      )}

      {/* Combined Add Company + AI Pre-fill Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Add Company</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  AI extract on the left · edit details on the right
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-slate-800">

                {/* ── Left: AI Pre-fill ── */}
                <div className="p-6 lg:pr-6 lg:py-6">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 h-full min-h-[280px] flex flex-col">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                      <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-300">AI Pre-fill</span>
                      <span className="text-[10px] text-slate-500 hidden sm:inline">
                        Paste text or upload a pitch deck
                      </span>
                    </div>

                    <div className="flex gap-1 bg-slate-900/60 rounded-lg p-0.5 mb-3">
                      {([
                        { id: 'text' as const, label: 'Paste Text', icon: AlignLeft },
                        { id: 'file' as const, label: 'Upload File', icon: Upload },
                      ]).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => { setAiTab(id); setExtractError(null) }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-md transition-all ${
                            aiTab === id
                              ? 'bg-violet-600 text-white shadow'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 min-h-[120px]">
                      {aiTab === 'text' ? (
                        <textarea
                          value={aiText}
                          onChange={(e) => setAiText(e.target.value)}
                          rows={6}
                          placeholder="Paste a pitch, memo, or any description…"
                          className="w-full h-full min-h-[140px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-y"
                        />
                      ) : (
                        <div
                          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setAiFile(f) }}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => fileRef.current?.click()}
                          className="h-full min-h-[140px] flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-violet-500/50 rounded-xl px-4 py-6 text-center cursor-pointer transition-colors"
                        >
                          {aiFile ? (
                            <div className="flex items-center justify-center gap-2 w-full">
                              <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                              <span className="text-xs text-slate-200 truncate flex-1 min-w-0">{aiFile.name}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setAiFile(null) }}
                                className="text-slate-600 hover:text-slate-400 shrink-0 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Drop <span className="text-violet-400">PDF, DOCX, or PPTX</span>
                              <br />
                              <span className="text-slate-600">or click to browse</span>
                            </p>
                          )}
                          <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.pptx"
                            className="hidden"
                            onChange={(e) => setAiFile(e.target.files?.[0] ?? null)}
                          />
                        </div>
                      )}
                    </div>

                    {extractError && (
                      <p className="mt-3 text-[11px] text-rose-400 bg-rose-950/30 border border-rose-700/30 rounded-lg px-2.5 py-2">
                        {extractError}
                      </p>
                    )}

                    {aiFields.size > 0 && !extractError && (
                      <p className="mt-3 text-[11px] text-violet-400">
                        <CheckCircle2 className="w-3 h-3 inline mr-1 align-text-bottom" />
                        {aiFields.size} field{aiFields.size !== 1 ? 's' : ''} pre-filled → review on the right
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={extracting || !canExtract}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-40 text-violet-300 text-xs font-medium rounded-xl border border-violet-500/20 transition-all"
                    >
                      {extracting ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> Extract with AI</>
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Right: Form ── */}
                <div className="p-6 lg:pl-6 space-y-4 bg-slate-900/50">
                  <div className="lg:hidden -mt-2 mb-4 border-t border-slate-800 pt-4">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Company details
                    </p>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600 mb-3">
                      Company details
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      {labelWithAI('Company Name *', 'name')}
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setAiFields((s) => { const n = new Set(s); n.delete('name'); return n }) }}
                      placeholder="e.g. Kopi Technologies"
                      className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors ${aiFields.has('name') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          {labelWithAI('Industry *', 'industry')}
                        </label>
                        <select
                          value={form.industry}
                          onChange={(e) => {
                            const industry = e.target.value
                            setForm((f) => ({
                              ...f,
                              industry,
                              industry_custom: industry === 'Other' ? f.industry_custom : '',
                            }))
                            setAiFields((s) => { const n = new Set(s); n.delete('industry'); return n })
                          }}
                          className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition-colors ${aiFields.has('industry') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                        >
                          <option value="">Select…</option>
                          {INDUSTRY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      {form.industry === 'Other' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Specify industry *
                          </label>
                          <input
                            value={form.industry_custom}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, industry_custom: e.target.value }))
                              setAiFields((s) => { const n = new Set(s); n.delete('industry'); return n })
                            }}
                            placeholder="e.g. AgriTech, GovTech, Logistics"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        {labelWithAI('Stage *', 'stage')}
                      </label>
                      <select
                        value={form.stage}
                        onChange={(e) => { setForm((f) => ({ ...f, stage: e.target.value })); setAiFields((s) => { const n = new Set(s); n.delete('stage'); return n }) }}
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition-colors ${aiFields.has('stage') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                      >
                        <option value="">Select…</option>
                        {STAGE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        {labelWithAI('Problem / Challenge', 'problem')}
                      </label>
                      <textarea
                        value={form.problem}
                        onChange={(e) => { setForm((f) => ({ ...f, problem: e.target.value })); setAiFields((s) => { const n = new Set(s); n.delete('problem'); return n }) }}
                        rows={3}
                        placeholder="What problem is the company solving?"
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none ${aiFields.has('problem') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        {labelWithAI('Goals', 'goals')}
                      </label>
                      <textarea
                        value={form.goals}
                        onChange={(e) => { setForm((f) => ({ ...f, goals: e.target.value })); setAiFields((s) => { const n = new Set(s); n.delete('goals'); return n }) }}
                        rows={3}
                        placeholder="What does the company want from mentorship?"
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none ${aiFields.has('goals') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        {labelWithAI('Team Size', 'size')}
                      </label>
                      <input
                        value={form.size}
                        onChange={(e) => { setForm((f) => ({ ...f, size: e.target.value })); setAiFields((s) => { const n = new Set(s); n.delete('size'); return n }) }}
                        placeholder="e.g. 5-10"
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors ${aiFields.has('size') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        WhatsApp <span className="font-normal text-slate-600">optional</span>
                      </label>
                      <input
                        value={form.whatsapp_number}
                        onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                        placeholder="+60123456789"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <p className="mt-1 text-[10px] text-slate-600 leading-snug">
                        For linking inbound messages to this company
                      </p>
                    </div>
                  </div>

                  {saveError && (
                    <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-700/30 rounded-xl px-3 py-2">
                      {saveError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/80">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors sm:min-w-[100px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  saved ||
                  !form.name.trim() ||
                  !resolveIndustry(form) ||
                  !form.stage
                }
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors sm:min-w-[140px]"
              >
                {saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  'Save Company'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import type { Company } from '@/lib/types'
import { createCompany, extractProfile, extractProfileFromDoc, updateCompany } from '@/lib/api'
import {
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  Upload,
  AlignLeft,
  FileText,
} from 'lucide-react'

const STAGE_OPTS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Late Stage']
const INDUSTRY_OPTS = ['FinTech', 'HealthTech', 'EdTech', 'SaaS', 'E-Commerce', 'DeepTech', 'CleanTech', 'Other']

const EMPTY_FORM = {
  name: '',
  industry: '',
  industry_custom: '',
  stage: '',
  about: '',
  problem: '',
  goals: '',
  size: '',
  whatsapp_number: '',
}

export function companyToForm(c: Company | null): typeof EMPTY_FORM {
  if (!c) return { ...EMPTY_FORM }
  const presets = INDUSTRY_OPTS.filter((o) => o !== 'Other')
  if (presets.includes(c.industry)) {
    return {
      name: c.name ?? '',
      industry: c.industry,
      industry_custom: '',
      stage: c.stage ?? '',
      about: c.about ?? '',
      problem: c.problem ?? '',
      goals: c.goals ?? '',
      size: c.size ?? '',
      whatsapp_number: c.whatsapp_number ?? '',
    }
  }
  return {
    name: c.name ?? '',
    industry: 'Other',
    industry_custom: c.industry,
    stage: c.stage ?? '',
    about: c.about ?? '',
    problem: c.problem ?? '',
    goals: c.goals ?? '',
    size: c.size ?? '',
    whatsapp_number: c.whatsapp_number ?? '',
  }
}

function resolveIndustry(form: typeof EMPTY_FORM): string {
  if (form.industry === 'Other') return form.industry_custom.trim()
  return form.industry
}

export interface CompanyProfileModalProps {
  open: boolean
  onClose: () => void
  /** `null` = create */
  company: Company | null
  onCreated?: (company: Company) => void
  onUpdated?: (company: Company) => void
}

export function CompanyProfileModal({
  open,
  onClose,
  company,
  onCreated,
  onUpdated,
}: CompanyProfileModalProps) {
  const isEdit = company !== null

  const [form, setForm] = useState(() => companyToForm(company))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [aiTab, setAiTab] = useState<'text' | 'file'>('text')
  const [aiText, setAiText] = useState('')
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [aiFields, setAiFields] = useState<Set<string>>(new Set())

  const fileRef = useRef<HTMLInputElement>(null)

  function handleClose() {
    onClose()
  }

  async function handleExtract() {
    setExtracting(true)
    setExtractError(null)
    try {
      let profile: {
        name: string
        industry: string
        stage: string
        about: string
        problem: string
        goals: string
        size: string
      }
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
        if (profile.name?.trim()) {
          next.name = profile.name.trim()
          filled.add('name')
        }
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
        if (profile.stage) {
          next.stage = profile.stage
          filled.add('stage')
        }
        if (profile.about?.trim()) {
          next.about = profile.about.trim()
          filled.add('about')
        }
        if (profile.problem?.trim()) {
          next.problem = profile.problem.trim()
          filled.add('problem')
        }
        if (profile.goals?.trim()) {
          next.goals = profile.goals.trim()
          filled.add('goals')
        }
        if (profile.size?.trim()) {
          next.size = profile.size.trim()
          filled.add('size')
        }
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
      const payload = {
        name: form.name.trim(),
        industry,
        stage: form.stage,
        about: form.about.trim(),
        problem: form.problem.trim(),
        goals: form.goals.trim(),
        size: form.size.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
      }
      if (isEdit && company) {
        const { company: updated } = await updateCompany(company.id, payload)
        onUpdated?.(updated)
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          handleClose()
        }, 900)
      } else {
        const { company: created } = await createCompany(payload)
        onCreated?.(created)
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          handleClose()
        }, 900)
      }
    } catch (e) {
      setSaveError(isEdit ? 'Failed to update. Please try again.' : 'Failed to save. Please try again.')
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{isEdit ? 'Edit Company' : 'Add Company'}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isEdit
                ? 'AI extract on the left can refresh fields · save changes on the right'
                : 'AI extract on the left · edit details on the right'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-slate-800">
            <div className="p-6 lg:pr-6 lg:py-6">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 h-full min-h-[280px] flex flex-col">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-300">AI Pre-fill</span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">Paste text or upload a pitch deck</span>
                </div>

                <div className="flex gap-1 bg-slate-900/60 rounded-lg p-0.5 mb-3">
                  {[
                    { id: 'text' as const, label: 'Paste Text', icon: AlignLeft },
                    { id: 'file' as const, label: 'Upload File', icon: Upload },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setAiTab(id)
                        setExtractError(null)
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-md transition-all ${
                        aiTab === id ? 'bg-violet-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'
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
                      onDrop={(e) => {
                        e.preventDefault()
                        const f = e.dataTransfer.files[0]
                        if (f) setAiFile(f)
                      }}
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setAiFile(null)
                            }}
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
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> Extract with AI
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6 lg:pl-6 space-y-4 bg-slate-900/50">
              <div className="lg:hidden -mt-2 mb-4 border-t border-slate-800 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">Company details</p>
              </div>
              <div className="hidden lg:block">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600 mb-3">Company details</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('Company Name *', 'name')}</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }))
                    setAiFields((s) => {
                      const n = new Set(s)
                      n.delete('name')
                      return n
                    })
                  }}
                  placeholder="e.g. Kopi Technologies"
                  className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors ${aiFields.has('name') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('Industry *', 'industry')}</label>
                    <select
                      value={form.industry}
                      onChange={(e) => {
                        const industry = e.target.value
                        setForm((f) => ({
                          ...f,
                          industry,
                          industry_custom: industry === 'Other' ? f.industry_custom : '',
                        }))
                        setAiFields((s) => {
                          const n = new Set(s)
                          n.delete('industry')
                          return n
                        })
                      }}
                      className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition-colors ${aiFields.has('industry') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                    >
                      <option value="">Select…</option>
                      {INDUSTRY_OPTS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.industry === 'Other' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Specify industry *</label>
                      <input
                        value={form.industry_custom}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, industry_custom: e.target.value }))
                          setAiFields((s) => {
                            const n = new Set(s)
                            n.delete('industry')
                            return n
                          })
                        }}
                        placeholder="e.g. AgriTech, GovTech, Logistics"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('Stage *', 'stage')}</label>
                  <select
                    value={form.stage}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, stage: e.target.value }))
                      setAiFields((s) => {
                        const n = new Set(s)
                        n.delete('stage')
                        return n
                      })
                    }}
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition-colors ${aiFields.has('stage') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                  >
                    <option value="">Select…</option>
                    {STAGE_OPTS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('About the company', 'about')}</label>
                <textarea
                  value={form.about}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, about: e.target.value }))
                    setAiFields((s) => {
                      const n = new Set(s)
                      n.delete('about')
                      return n
                    })
                  }}
                  rows={4}
                  placeholder="What do you build or offer? Who is it for? Mission or elevator pitch — broader context beyond the problem statement."
                  className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none ${aiFields.has('about') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('Problem / Challenge', 'problem')}</label>
                  <textarea
                    value={form.problem}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, problem: e.target.value }))
                      setAiFields((s) => {
                        const n = new Set(s)
                        n.delete('problem')
                        return n
                      })
                    }}
                    rows={3}
                    placeholder="What problem is the company solving?"
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none ${aiFields.has('problem') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('Goals', 'goals')}</label>
                  <textarea
                    value={form.goals}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, goals: e.target.value }))
                      setAiFields((s) => {
                        const n = new Set(s)
                        n.delete('goals')
                        return n
                      })
                    }}
                    rows={3}
                    placeholder="What does the company want from mentorship?"
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors resize-none ${aiFields.has('goals') ? 'border-violet-500/50 focus:border-violet-500' : 'border-slate-700 focus:border-violet-500'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{labelWithAI('Team Size', 'size')}</label>
                  <input
                    value={form.size}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, size: e.target.value }))
                      setAiFields((s) => {
                        const n = new Set(s)
                        n.delete('size')
                        return n
                      })
                    }}
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
                  <p className="mt-1 text-[10px] text-slate-600 leading-snug">For linking inbound messages to this company</p>
                </div>
              </div>

              {saveError && (
                <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-700/30 rounded-xl px-3 py-2">{saveError}</p>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors sm:min-w-[100px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || !form.name.trim() || !resolveIndustry(form) || !form.stage}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors sm:min-w-[140px]"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </>
            ) : saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Save Company'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

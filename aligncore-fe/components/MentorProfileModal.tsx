'use client'

import { useState, useRef } from 'react'
import type { Mentor } from '@/lib/types'
import { createMentor, extractMentorFromDoc, updateMentor } from '@/lib/api'
import { X, Loader2, CheckCircle2, Sparkles, FileUp, FileText } from 'lucide-react'
import { MentorPhotoEditor } from '@/components/MentorPhotoEditor'

export const EXPERTISE_OPTS = [
  'Product', 'Growth', 'Fundraising', 'Engineering', 'Design', 'Operations',
  'Marketing', 'Sales', 'Legal', 'Finance', 'HR', 'Strategy',
]

const emptyForm = {
  name: '',
  bio: '',
  industry: '',
  available: true,
  expertise: [] as string[],
  whatsapp_number: '',
}

function mentorToForm(m: Mentor | null) {
  if (!m) return { ...emptyForm }
  return {
    name: m.name ?? '',
    bio: m.bio ?? '',
    industry: m.industry ?? '',
    available: m.available ?? true,
    expertise: Array.isArray(m.expertise) ? [...m.expertise] : [],
    whatsapp_number: m.whatsapp_number ?? '',
  }
}

export interface MentorProfileModalProps {
  open: boolean
  onClose: () => void
  /** `null` = create a new mentor */
  mentor: Mentor | null
  onCreated?: (mentor: Mentor) => void
  onUpdated?: (mentor: Mentor) => void
}

export function MentorProfileModal({
  open,
  onClose,
  mentor,
  onCreated,
  onUpdated,
}: MentorProfileModalProps) {
  const isEdit = mentor !== null

  const [form, setForm] = useState(() => mentorToForm(mentor))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [aiExtract, setAiExtract] = useState(false)
  const [extractFiles, setExtractFiles] = useState<File[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractDone, setExtractDone] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const extractFileRef = useRef<HTMLInputElement>(null)
  const [customExpertiseInput, setCustomExpertiseInput] = useState('')

  function toggleExpertise(tag: string) {
    setForm((f) => ({
      ...f,
      expertise: f.expertise.includes(tag)
        ? f.expertise.filter((e) => e !== tag)
        : [...f.expertise, tag],
    }))
  }

  async function triggerExtract(files: File[]) {
    if (!files.length) return
    setExtracting(true)
    setExtractError(null)
    setExtractDone(false)
    try {
      const { profile } = await extractMentorFromDoc(files)
      setForm((f) => ({
        ...f,
        name: profile.name || f.name,
        bio: profile.bio || f.bio,
        industry: profile.industry || f.industry,
        expertise: profile.expertise.length > 0 ? profile.expertise : f.expertise,
      }))
      setExtractDone(true)
    } catch (err) {
      setExtractError((err as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  function handleExtractFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!selected.length) return
    setExtractFiles(selected)
    triggerExtract(selected)
  }

  function handleExtractDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    if (!dropped.length) return
    setExtractFiles(dropped)
    triggerExtract(dropped)
  }

  function addCustomExpertise() {
    const tag = customExpertiseInput.trim()
    if (tag && !form.expertise.includes(tag)) {
      setForm((f) => ({ ...f, expertise: [...f.expertise, tag] }))
    }
    setCustomExpertiseInput('')
  }

  function handleClose() {
    onClose()
  }

  async function handleSave() {
    if (!form.name.trim() || !form.bio.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      if (isEdit && mentor) {
        const { mentor: updated } = await updateMentor(mentor.id, {
          name: form.name.trim(),
          bio: form.bio.trim(),
          industry: form.industry.trim(),
          expertise: form.expertise,
          available: form.available,
          whatsapp_number: form.whatsapp_number.trim(),
        })
        onUpdated?.(updated)
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          handleClose()
        }, 900)
      } else {
        const { mentor: created } = await createMentor({
          name: form.name.trim(),
          bio: form.bio.trim(),
          industry: form.industry.trim(),
          expertise: form.expertise,
          available: form.available,
          whatsapp_number: form.whatsapp_number.trim(),
        })
        onCreated?.(created)
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          handleClose()
        }, 900)
      }
    } catch (e) {
      setSaveError(isEdit ? 'Failed to update mentor. Please try again.' : 'Failed to save mentor. Please try again.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{isEdit ? 'Edit Mentor' : 'Add Mentor'}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isEdit
                ? 'Refresh CV details with AI on the left · save changes on the right'
                : 'Extract from CV on the left · complete profile on the right'}
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
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 min-h-[280px] flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">AI extract from document</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">
                        CV, resume, or bio deck — merges into the form (you can edit before saving)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiExtract((a) => !a)
                      setExtractFiles([])
                      setExtractDone(false)
                      setExtractError(null)
                    }}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${aiExtract ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span
                      className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${aiExtract ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {aiExtract ? (
                  <div className="flex-1 flex flex-col min-h-[160px] space-y-2">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleExtractDrop}
                      onClick={() => !extracting && extractFileRef.current?.click()}
                      className="flex-1 min-h-[140px] border-2 border-dashed border-indigo-700/40 hover:border-indigo-500/55 rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-indigo-950/15"
                    >
                      <input
                        ref={extractFileRef}
                        type="file"
                        accept=".pdf,.docx,.pptx"
                        multiple
                        className="hidden"
                        onChange={handleExtractFileChange}
                      />
                      {extracting ? (
                        <>
                          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                          <p className="text-xs text-slate-400">Extracting profile…</p>
                        </>
                      ) : extractDone ? (
                        <>
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                          <p className="text-xs text-slate-300 text-center">Extracted — review fields on the right</p>
                          {extractFiles.length > 0 && (
                            <p className="text-[10px] text-slate-500 truncate max-w-full px-2">
                              {extractFiles.length === 1
                                ? extractFiles[0].name
                                : `${extractFiles.length} files · ${extractFiles.map((f) => f.name).join(', ')}`}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-600">Click to replace file</p>
                        </>
                      ) : extractFiles.length > 0 ? (
                        <>
                          <FileText className="w-6 h-6 text-indigo-400" />
                          <p className="text-xs text-slate-200 truncate max-w-full px-2 text-center">
                            {extractFiles.length === 1
                              ? extractFiles[0].name
                              : `${extractFiles.length} files selected`}
                          </p>
                          <p className="text-[10px] text-slate-500">Click to change</p>
                        </>
                      ) : (
                        <>
                          <FileUp className="w-6 h-6 text-slate-500" />
                          <p className="text-xs text-slate-400 text-center">
                            Drop files or <span className="text-indigo-400">browse</span>
                          </p>
                          <p className="text-[10px] text-slate-600">PDF, DOCX, PPTX · up to 5 files · 15 MB each</p>
                        </>
                      )}
                    </div>
                    {extractError && (
                      <p className="text-[11px] text-rose-400 bg-rose-950/30 border border-rose-700/30 rounded-lg px-2.5 py-2">
                        {extractError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-8">
                    <p className="text-xs text-slate-600 text-center leading-relaxed">
                      Turn on <span className="text-slate-500">AI extract</span> to upload a CV and merge name, bio,
                      industry, and expertise into this profile.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 lg:pl-6 space-y-4 bg-slate-900/50">
              <div className="lg:hidden -mt-2 mb-1 border-t border-slate-800 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">Mentor profile</p>
              </div>
              <div className="hidden lg:block">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600 mb-3">Mentor profile</p>
              </div>

              {isEdit && mentor ? (
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 -mt-1 lg:-mt-2">
                  <MentorPhotoEditor mentorId={mentor.id} photoUrl={mentor.photo_url} onMentorUpdated={onUpdated} />
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sarah Chen"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry</label>
                  <input
                    value={form.industry}
                    onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                    placeholder="e.g. FinTech, SaaS"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <p className="mt-1 text-[10px] text-slate-600 leading-snug">Links inbound messages to this mentor</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Bio *</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={4}
                  placeholder="Brief background and experience…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Expertise</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {EXPERTISE_OPTS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleExpertise(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        form.expertise.includes(tag)
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {form.expertise.filter((e) => !EXPERTISE_OPTS.includes(e)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.expertise
                      .filter((e) => !EXPERTISE_OPTS.includes(e))
                      .map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-violet-600/15 border border-violet-500/30 text-violet-300 rounded-lg"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({ ...f, expertise: f.expertise.filter((e) => e !== tag) }))
                            }
                            className="hover:text-white transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
                <input
                  value={customExpertiseInput}
                  onChange={(e) => setCustomExpertiseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addCustomExpertise()
                    }
                  }}
                  onBlur={addCustomExpertise}
                  placeholder="Custom tag… (Enter or comma)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, available: !f.available }))}
                  className={`w-9 h-5 rounded-full transition-colors shrink-0 ${form.available ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <span
                    className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.available ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
                <span className="text-xs text-slate-400">Available for matching</span>
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
            onClick={handleClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors sm:min-w-[100px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || !form.name.trim() || !form.bio.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors sm:min-w-[140px]"
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
              'Save Mentor'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

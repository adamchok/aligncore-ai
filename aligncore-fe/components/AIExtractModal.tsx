'use client'

import { useState, useRef } from 'react'
import { extractProfile, extractProfileFromDoc } from '../lib/api'
import type { ExtractedProfile } from '../lib/api'
import { Sparkles, X, Loader2, CheckCircle2, Upload, FileText, AlignLeft } from 'lucide-react'

interface Props {
  onExtracted: (profile: ExtractedProfile) => void
  onClose: () => void
}

type Tab = 'text' | 'file'

const ACCEPTED = '.pdf,.docx,.pptx'
const ACCEPT_LABEL = 'PDF, Word (.docx), PowerPoint (.pptx)'

export default function AIExtractModal({ onExtracted, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(f: File | null) {
    setFile(f)
    setError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFileChange(f)
  }

  async function handleExtract() {
    setError(null)
    setLoading(true)
    try {
      let profile: ExtractedProfile
      if (tab === 'text') {
        if (text.trim().length < 20) {
          setError('Please enter at least 20 characters.')
          setLoading(false)
          return
        }
        const res = await extractProfile(text)
        profile = res.profile
      } else {
        if (!file) {
          setError('Please select a file.')
          setLoading(false)
          return
        }
        const res = await extractProfileFromDoc(file)
        profile = res.profile
      }
      setDone(true)
      setTimeout(() => {
        onExtracted(profile)
        onClose()
      }, 800)
    } catch (e) {
      setError((e as Error).message.replace(/^API extract-doc → \d+: /, '') || 'Extraction failed. Please try again.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = tab === 'text' ? text.trim().length >= 20 : file !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-slate-100">AI Profile Extraction</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-4">
          {([
            { id: 'text' as Tab, label: 'Paste Text', icon: AlignLeft },
            { id: 'file' as Tab, label: 'Upload Document', icon: Upload },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setError(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
                tab === id
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Paste text tab */}
        {tab === 'text' && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Paste a company description, pitch, or any text — Gemini extracts a structured profile.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="e.g. We are FinTrack, a Series A FinTech startup with 15 engineers building AI-powered bookkeeping for SMEs in Southeast Asia…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
            <p className="text-[10px] text-slate-600 mt-1">{text.length} / 2000 chars</p>
          </>
        )}

        {/* File upload tab */}
        {tab === 'file' && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Upload a company pitch deck, profile document, or slide deck.{' '}
              <span className="text-slate-500">Supports {ACCEPT_LABEL}.</span>
            </p>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-violet-500/60 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-violet-400" />
                  <p className="text-sm font-medium text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-600" />
                  <p className="text-sm text-slate-400">
                    Drag & drop or{' '}
                    <span className="text-violet-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-600">{ACCEPT_LABEL} · max 15 MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Service labels */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {[
                { ext: 'PDF', label: 'Gemini Multimodal AI' },
                { ext: 'DOCX', label: 'Mammoth + Gemini' },
                { ext: 'PPTX', label: 'Slide parser + Gemini' },
              ].map(({ ext, label }) => (
                <span key={ext} className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-500">
                  <span className="text-violet-400 font-semibold">{ext}</span> — {label}
                </span>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-700/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExtract}
            disabled={loading || done || !canSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {done ? (
              <><CheckCircle2 className="w-4 h-4" /> Extracted!</>
            ) : loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Extract Profile</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

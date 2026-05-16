'use client'

import { useState, useRef } from 'react'
import { batchImportCompanies } from '../lib/api'
import type { CompanyCSVRow } from '../lib/types'
import { Upload, X, CheckCircle2, Loader2, AlertTriangle, FileText } from 'lucide-react'

type ModalState = 'idle' | 'preview' | 'importing' | 'done'

interface Props {
  onClose: () => void
  onDone: (count: number) => void
}

function parseCSV(text: string): CompanyCSVRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as unknown as CompanyCSVRow
    })
    .filter((row) => row.name?.trim())
}

export default function CSVImportModal({ onClose, onDone }: Props) {
  const [state, setState] = useState<ModalState>('idle')
  const [rows, setRows] = useState<CompanyCSVRow[]>([])
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a .csv file.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setError('No valid rows found. Make sure the CSV has a header row with at least a "name" column.')
        return
      }
      if (parsed.length > 50) {
        setError('Maximum 50 rows per import. Please split your file.')
        return
      }
      setRows(parsed)
      setState('preview')
      setError(null)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    setState('importing')
    try {
      const data = await batchImportCompanies(rows)
      setResult({ created: data.created, errors: data.errors })
      setState('done')
      if (data.created > 0) onDone(data.created)
    } catch (e) {
      setError('Import failed. Please try again.')
      setState('preview')
      console.error(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-slate-100">Import Companies (CSV)</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {state === 'idle' && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Upload a CSV with columns:{' '}
              <code className="text-violet-300 bg-slate-800 px-1 rounded">
                name, industry, stage, problem, goals, size
              </code>
              . Only <strong className="text-slate-300">name</strong>,{' '}
              <strong className="text-slate-300">industry</strong>, and{' '}
              <strong className="text-slate-300">stage</strong> are required. Max 50 rows.
            </p>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-700 hover:border-violet-500/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                Drag & drop a CSV file here, or{' '}
                <span className="text-violet-400 underline">click to browse</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-700/30 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </>
        )}

        {state === 'preview' && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Preview — {rows.length} row{rows.length !== 1 ? 's' : ''} ready to import.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-700/50 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/60">
                  <tr>
                    {['Name', 'Industry', 'Stage', 'Size'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((row, i) => (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-200 max-w-[150px] truncate">{row.name}</td>
                      <td className="px-3 py-2 text-slate-400">{row.industry || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{row.stage || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{row.size || '—'}</td>
                    </tr>
                  ))}
                  {rows.length > 15 && (
                    <tr className="border-t border-slate-800">
                      <td colSpan={4} className="px-3 py-2 text-slate-600 text-center">
                        + {rows.length - 15} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-700/30 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setState('idle'); setRows([]); setError(null) }}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" /> Import {rows.length} Companies
              </button>
            </div>
          </>
        )}

        {state === 'importing' && (
          <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            <p className="text-sm">Importing {rows.length} companies…</p>
          </div>
        )}

        {state === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  {result.created} compan{result.created !== 1 ? 'ies' : 'y'} imported successfully
                </p>
                {result.errors.length > 0 && (
                  <p className="text-xs text-amber-400 mt-0.5">
                    {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped
                  </p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-slate-700/50 p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Skipped rows</p>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-rose-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

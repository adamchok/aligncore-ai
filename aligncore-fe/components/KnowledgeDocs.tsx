'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { FileText, FileUp, Trash2, Loader2 } from 'lucide-react'

const BE = process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:4000'

interface KnowledgeDoc {
  docId: string
  filename: string
  mime_type: string
  uploaded_at: string
  gcs_path: string | null
}

interface Props {
  entityType: 'company' | 'mentor'
  entityId: string
}

function mimeLabel(mime: string): string {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('wordprocessing')) return 'DOCX'
  if (mime.includes('presentationml')) return 'PPTX'
  if (mime.includes('text')) return 'TXT'
  return mime.split('/').pop()?.toUpperCase() ?? 'FILE'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function KnowledgeDocs({ entityType, entityId }: Props) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploading = uploadingCount > 0

  const baseUrl = `${BE}/api/knowledge/${entityType}/${entityId}`

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(baseUrl)
      if (res.ok) {
        const data = (await res.json()) as { documents: KnowledgeDoc[] }
        setDocs(data.documents ?? [])
      }
    } finally {
      setListLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploadingCount(files.length)
    setError(null)
    const errors: string[] = []
    for (const file of files) {
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          errors.push(data.error ?? `Upload failed (${res.status})`)
        }
      } catch (err) {
        errors.push((err as Error).message)
      }
      setUploadingCount((n) => Math.max(0, n - 1))
    }
    await fetchDocs()
    if (errors.length) setError(errors[0])
  }

  async function deleteDoc(docId: string) {
    try {
      await fetch(`${baseUrl}/${docId}`, { method: 'DELETE' })
      setDocs((prev) => prev.filter((d) => d.docId !== docId))
    } catch {
      // non-fatal
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) uploadFiles(files)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Knowledge Documents ({docs.length})
      </h2>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all mb-4 ${
          dragActive
            ? 'border-violet-500 bg-violet-500/5'
            : 'border-slate-700 hover:border-violet-500/60 bg-slate-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-sm text-slate-400">
              {uploadingCount > 1 ? `Uploading ${uploadingCount} files…` : 'Uploading & extracting text…'}
            </p>
          </>
        ) : (
          <>
            <FileUp className="w-6 h-6 text-slate-500" />
            <p className="text-sm text-slate-400">
              Drop files here or{' '}
              <span className="text-violet-400">browse</span>
            </p>
            <p className="text-xs text-slate-600">PDF, DOCX, PPTX, TXT — max 20 MB each</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {listLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-slate-600 text-sm">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div
              key={d.docId}
              className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5"
            >
              <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{d.filename}</p>
                <p className="text-xs text-slate-500">
                  {mimeLabel(d.mime_type)} · {formatDate(d.uploaded_at)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteDoc(d.docId)
                }}
                className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                title="Delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useRef, useState, useEffect } from 'react'
import type { Company } from '@/lib/types'
import { updateCompany, uploadCompanyProfilePhoto } from '@/lib/api'
import { validateProfileImage } from '@/lib/mentorPhoto'
import { Building2, Camera, Loader2, Trash2 } from 'lucide-react'

export function CompanyPhotoEditor({
  companyId,
  photoUrl,
  onCompanyUpdated,
}: {
  companyId: string
  photoUrl?: string | null
  onCompanyUpdated?: (c: Company) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(photoUrl?.trim() ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setPreview(photoUrl?.trim() ?? '')
  }, [photoUrl])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const v = validateProfileImage(file)
    if (v) {
      setErr(v)
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const company = await uploadCompanyProfilePhoto(companyId, file)
      setPreview(company.photo_url ?? '')
      onCompanyUpdated?.(company)
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function clearPhoto() {
    setErr(null)
    setBusy(true)
    try {
      const { company } = await updateCompany(companyId, { photo_url: '' })
      setPreview('')
      onCompanyUpdated?.(company)
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4">
      <div className="relative shrink-0">
        <div className="w-24 h-24 rounded-2xl border-2 border-slate-600 bg-slate-800 overflow-hidden flex items-center justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- public or signed GCS URL from API
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-10 h-10 text-slate-500" aria-hidden />
          )}
          {busy && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400">Logo / photo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            {preview ? 'Replace image' : 'Upload image'}
          </button>
          {preview ? (
            <button
              type="button"
              disabled={busy}
              onClick={clearPhoto}
              aria-label="Remove photo"
              title="Remove photo"
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onPick}
        />
        <p className="text-[10px] text-slate-600 leading-snug">JPG, PNG, WebP or GIF · max 5 MB</p>
        {err ? <p className="text-[11px] text-rose-400">{err}</p> : null}
      </div>
    </div>
  )
}

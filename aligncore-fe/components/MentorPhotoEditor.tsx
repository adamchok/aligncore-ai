'use client'

import { useRef, useState, useEffect } from 'react'
import type { Mentor } from '@/lib/types'
import { updateMentor, uploadMentorProfilePhoto } from '@/lib/api'
import { validateProfileImage } from '@/lib/mentorPhoto'
import { Camera, Loader2, UserRound, X } from 'lucide-react'

export function MentorPhotoEditor({
  mentorId,
  photoUrl,
  onMentorUpdated,
}: {
  mentorId: string
  photoUrl?: string | null
  onMentorUpdated?: (m: Mentor) => void
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
      const mentor = await uploadMentorProfilePhoto(mentorId, file)
      setPreview(mentor.photo_url ?? '')
      onMentorUpdated?.(mentor)
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
      const { mentor } = await updateMentor(mentorId, { photo_url: '' })
      setPreview('')
      onMentorUpdated?.(mentor)
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4">
      <div className="relative shrink-0">
        <div className="w-24 h-24 rounded-full border-2 border-slate-600 bg-slate-800 overflow-hidden flex items-center justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- public or signed GCS URL from API
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserRound className="w-10 h-10 text-slate-500" aria-hidden />
          )}
          {busy && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center rounded-full">
              <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400">Profile photo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            {preview ? 'Replace photo' : 'Upload photo'}
          </button>
          {preview ? (
            <button
              type="button"
              disabled={busy}
              onClick={clearPhoto}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Remove
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

'use client'

import { useState, useEffect, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, QueryDocumentSnapshot } from 'firebase/firestore'
import type { Mentor } from '@/lib/types'
import { Users, Plus, Briefcase, Loader2, FileText } from 'lucide-react'
import Link from 'next/link'
import { MentorProfileModal } from '@/components/MentorProfileModal'

function MentorCard({ mentor }: { mentor: Mentor }) {
  const docCount = mentor.knowledge_doc_count ?? 0
  const hasDocs = docCount > 0

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600/70 transition-all h-full min-h-[268px] flex flex-col gap-4">
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 shrink-0 overflow-hidden flex items-center justify-center">
          {mentor.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Storage URL
            <img src={mentor.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users className="w-6 h-6 text-indigo-400" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100 leading-snug">{mentor.name}</h3>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${mentor.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}
            >
              {mentor.available ? 'Available' : 'Busy'}
            </span>
          </div>
          {mentor.industry ? (
            <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3 shrink-0" /> <span className="truncate">{mentor.industry}</span>
            </p>
          ) : (
            <div className="mt-1 h-4" aria-hidden />
          )}
          <p className="text-xs text-slate-400 mt-1 line-clamp-3 flex-1">{mentor.bio}</p>
          <div className="flex flex-wrap gap-1 mt-2 line-clamp-2 max-h-[52px] overflow-hidden">
            {(mentor.expertise ?? []).slice(0, 8).map((e) => (
              <span key={e} className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded-md">
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`mt-auto pt-3 border-t border-slate-700/40 flex items-center gap-2 rounded-b-xl ${hasDocs ? 'text-emerald-400/95' : 'text-slate-600'}`}
      >
        <FileText className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
        <span className="text-[10px] font-medium leading-tight">
          {hasDocs ? `${docCount} knowledge doc${docCount === 1 ? '' : 's'}` : 'No knowledge documents'}
        </span>
      </div>
    </div>
  )
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalNonce, setModalNonce] = useState(0)
  /** Mentor just created via API — keep in UI until snapshot includes it (handles DB lag / env mismatch). */
  const pendingMentorRef = useRef<Mentor | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'mentors'),
      (snap) => {
        const fromDb = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Mentor))
        const pending = pendingMentorRef.current
        if (pending && !fromDb.some((m) => m.id === pending.id)) {
          setMentors([pending, ...fromDb])
        } else {
          if (pending && fromDb.some((m) => m.id === pending.id)) {
            pendingMentorRef.current = null
          }
          setMentors(fromDb)
        }
        setLoading(false)
      },
      (err) => {
        console.error('[mentors] Firestore:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  function openCreate() {
    setModalNonce((n) => n + 1)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mentors</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {mentors.length} mentor{mentors.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-900/40"
        >
          <Plus className="w-4 h-4" /> Add Mentor
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : mentors.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No mentors yet. Add your first mentor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {mentors.map((m) => (
            <Link
              key={m.id}
              href={`/mentors/${m.id}`}
              className="block h-full min-h-[268px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <MentorCard mentor={m} />
            </Link>
          ))}
        </div>
      )}

      <MentorProfileModal
        key={modalNonce}
        open={showModal}
        onClose={closeModal}
        mentor={null}
        onCreated={(mentor) => {
          pendingMentorRef.current = mentor
          setMentors((prev) => {
            const rest = prev.filter((x) => x.id !== mentor.id)
            return [mentor, ...rest]
          })
        }}
      />
    </div>
  )
}

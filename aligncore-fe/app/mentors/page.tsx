'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, QueryDocumentSnapshot } from 'firebase/firestore'
import type { Mentor } from '@/lib/types'
import { createMentor } from '@/lib/api'
import { Users, Plus, X, Loader2, CheckCircle2, Briefcase } from 'lucide-react'
import Link from 'next/link'

const EXPERTISE_OPTS = [
  'Product', 'Growth', 'Fundraising', 'Engineering', 'Design', 'Operations',
  'Marketing', 'Sales', 'Legal', 'Finance', 'HR', 'Strategy',
]

function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600/70 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex-shrink-0">
          <Users className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">{mentor.name}</h3>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${mentor.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}
            >
              {mentor.available ? 'Available' : 'Busy'}
            </span>
          </div>
          {mentor.industry && (
            <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> {mentor.industry}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{mentor.bio}</p>
          {mentor.expertise?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {mentor.expertise.map((e) => (
                <span key={e} className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded-md">
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', bio: '', industry: '', available: true,
    expertise: [] as string[], whatsapp_number: '',
  })

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'mentors'), (snap) => {
      setMentors(
        snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Mentor))
      )
      setLoading(false)
    })
    return unsub
  }, [])

  function toggleExpertise(tag: string) {
    setForm((f) => ({
      ...f,
      expertise: f.expertise.includes(tag)
        ? f.expertise.filter((e) => e !== tag)
        : [...f.expertise, tag],
    }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.bio.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await createMentor({
        name: form.name.trim(),
        bio: form.bio.trim(),
        industry: form.industry.trim(),
        expertise: form.expertise,
        available: form.available,
        whatsapp_number: form.whatsapp_number.trim(),
      })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowModal(false)
        setForm({ name: '', bio: '', industry: '', available: true, expertise: [], whatsapp_number: '' })
      }, 1200)
    } catch (e) {
      setSaveError('Failed to save mentor. Please try again.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mentors</h1>
          <p className="text-sm text-slate-500 mt-0.5">{mentors.length} mentor{mentors.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mentors.map((m) => (
            <Link key={m.id} href={`/mentors/${m.id}`}>
              <MentorCard mentor={m} />
            </Link>
          ))}
        </div>
      )}

      {/* Add Mentor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-100">Add Mentor</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sarah Chen"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
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
                  WhatsApp Number
                  <span className="ml-1.5 text-[9px] text-slate-600 font-normal">links inbound messages to this mentor</span>
                </label>
                <input
                  value={form.whatsapp_number}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="e.g. +60123456789"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Bio *</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  placeholder="Brief background and experience…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Expertise</label>
                <div className="flex flex-wrap gap-2">
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
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, available: !f.available }))}
                  className={`w-9 h-5 rounded-full transition-colors ${form.available ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <span
                    className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.available ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
                <span className="text-xs text-slate-400">Available for matching</span>
              </div>
            </div>

            {saveError && (
              <p className="mt-4 text-xs text-rose-400 bg-rose-950/40 border border-rose-700/30 rounded-xl px-3 py-2">
                {saveError}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved || !form.name.trim() || !form.bio.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  'Save Mentor'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

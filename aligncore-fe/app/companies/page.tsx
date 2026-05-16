'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, QueryDocumentSnapshot } from 'firebase/firestore'
import type { Company } from '@/lib/types'
import { Building2, Plus, Loader2, FileText, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import CSVImportModal from '@/components/CSVImportModal'
import { CompanyProfileModal } from '@/components/CompanyProfileModal'

function CompanyCard({ company }: { company: Company }) {
  const docCount = company.knowledge_doc_count ?? 0
  const hasDocs = docCount > 0

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600/70 transition-all h-full min-h-[268px] flex flex-col gap-4 cursor-pointer">
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 shrink-0 overflow-hidden flex items-center justify-center">
          {company.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- GCS URL from API
            <img src={company.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-6 h-6 text-violet-400" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100 leading-snug">{company.name}</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 bg-violet-500/10 text-violet-400">
              {company.stage}
            </span>
          </div>
          <p className="text-xs text-violet-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 shrink-0" /> <span className="truncate">{company.industry}</span>
          </p>
          <div className="mt-1.5 flex flex-col gap-[6px] min-h-0">
            {company.about?.trim() ? (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">About</p>
                <p className="text-xs text-slate-400 line-clamp-3 leading-snug">{company.about.trim()}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                Problem
              </p>
              {company.problem ? (
                <p className="text-xs text-slate-400 line-clamp-3 leading-snug">{company.problem}</p>
              ) : (
                <p className="text-xs text-slate-600 line-clamp-2 italic leading-snug">
                  No problem statement yet.
                </p>
              )}
            </div>
            {company.goals ? (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                  Goals
                </p>
                <p className="text-xs text-slate-400 line-clamp-2 leading-snug">{company.goals}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={`mt-auto pt-5 border-t border-slate-700/40 flex items-center gap-2 rounded-b-xl ${hasDocs ? 'text-emerald-400/95' : 'text-slate-600'}`}
      >
        <FileText className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
        <span className="text-[10px] font-medium leading-tight">
          {hasDocs ? `${docCount} knowledge doc${docCount === 1 ? '' : 's'}` : 'No knowledge documents'}
        </span>
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalNonce, setModalNonce] = useState(0)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Company)))
      setLoading(false)
    })
    return unsub
  }, [])

  function openModal() {
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
            Import CSV
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/companies/${c.id}`}
              className="block h-full min-h-[268px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <CompanyCard company={c} />
            </Link>
          ))}
        </div>
      )}

      {showImport && (
        <CSVImportModal onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />
      )}

      <CompanyProfileModal
        key={modalNonce}
        open={showModal}
        onClose={closeModal}
        company={null}
      />
    </div>
  )
}

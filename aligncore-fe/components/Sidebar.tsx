'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  Sparkles,
  MessageSquare,
  Smartphone,
  ChevronRight,
  Zap,
} from 'lucide-react'

const NAV = [
  {
    group: 'Overview',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'Entities',
    items: [
      { href: '/mentors', label: 'Mentors', icon: Users },
      { href: '/companies', label: 'Companies', icon: Building2 },
    ],
  },
  {
    group: 'AI Tools',
    items: [
      { href: '/match', label: 'Match', icon: Sparkles },
      { href: '/onboard', label: 'Onboard', icon: MessageSquare },
    ],
  },
  {
    group: 'Settings',
    items: [{ href: '/settings/whatsapp', label: 'WhatsApp', icon: Smartphone }],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed top-0 left-0 h-full flex flex-col bg-slate-900 border-r border-slate-800 sidebar-scroll overflow-y-auto z-40"
      style={{ width: 'var(--sidebar-w)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-900/50">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100 leading-none">AlignCore</p>
          <p className="text-[10px] text-indigo-400 leading-none mt-0.5">AI</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                        active
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                      />
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="w-3 h-3 text-indigo-500" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-[10px] text-slate-600">AlignCore AI · MyHack 2026</p>
      </div>
    </aside>
  )
}

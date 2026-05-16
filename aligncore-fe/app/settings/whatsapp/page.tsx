'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  wahaGetSession,
  wahaGetSessionMe,
  wahaGetQR,
  wahaStartSession,
  wahaRestartSession,
  WAHASession,
  WAHASessionMe,
  formatWahaEngine,
  formatWahaLinkedPhone,
  normalizeWahaUiStatus,
  type WahaUiStatus,
} from '@/lib/api'
import { Smartphone, RefreshCw, CheckCircle2, AlertCircle, Loader2, QrCode, Play, RotateCcw } from 'lucide-react'
import Image from 'next/image'

const STATUS_CONFIG: Record<WahaUiStatus, { label: string; color: string; icon: React.ElementType }> = {
  CONNECTED: { label: 'Connected', color: 'text-emerald-400', icon: CheckCircle2 },
  DISCONNECTED: { label: 'Disconnected', color: 'text-rose-400', icon: AlertCircle },
  SCAN_QR_CODE: { label: 'Waiting for QR Scan', color: 'text-amber-400', icon: QrCode },
  STARTING: { label: 'Starting…', color: 'text-indigo-400', icon: Loader2 },
  STOPPED: { label: 'Stopped', color: 'text-slate-500', icon: AlertCircle },
  FAILED: { label: 'Failed', color: 'text-rose-400', icon: AlertCircle },
  UNKNOWN: { label: 'Unknown', color: 'text-slate-500', icon: AlertCircle },
}

export default function WhatsAppSettingsPage() {
  const [session, setSession] = useState<WAHASession | null>(null)
  const [linkedProfile, setLinkedProfile] = useState<WAHASessionMe | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [status, setStatus] = useState<WahaUiStatus>('UNKNOWN')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const sess = await wahaGetSession()
      setSession(sess)
      const sessionStatus = normalizeWahaUiStatus(sess.status)
      setStatus(sessionStatus)

      if (sessionStatus === 'CONNECTED') {
        setLinkedProfile(await wahaGetSessionMe())
      } else {
        setLinkedProfile(null)
      }

      if (sessionStatus === 'SCAN_QR_CODE') {
        const qrData = await wahaGetQR()
        setQr(qrData.qr)
      } else {
        setQr(null)
      }
    } catch {
      setStatus('UNKNOWN')
      setLinkedProfile(null)
    } finally {
      setLoading(false)
      setLastRefreshed(new Date())
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(() => {
      if (status === 'SCAN_QR_CODE' || status === 'STARTING') refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [refresh, status])

  async function handleAction(action: 'start' | 'restart') {
    setActionLoading(action)
    try {
      if (action === 'start') await wahaStartSession()
      else await wahaRestartSession()
      await new Promise((r) => setTimeout(r, 2000))
      await refresh()
    } catch {
      /* noop */
    } finally {
      setActionLoading(null)
    }
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN
  const StatusIcon = cfg.icon
  const engineLabel = session ? formatWahaEngine(session.engine) : null
  const phoneLabel = formatWahaLinkedPhone(linkedProfile)

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-emerald-400" />
          WhatsApp Connection
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage WAHA session for real-time message processing</p>
      </div>

      {/* Status Card */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Session Status</h2>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Checking status…</span>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <StatusIcon
              className={`w-6 h-6 shrink-0 mt-0.5 ${cfg.color} ${status === 'STARTING' ? 'animate-spin' : ''}`}
            />
            <div className="flex min-w-0 flex-col gap-2">
              <p className={`text-base font-semibold leading-snug ${cfg.color}`}>{cfg.label}</p>
              {session?.name && (
                <p className="text-xs leading-snug text-slate-500">Session: {session.name}</p>
              )}
              {status === 'CONNECTED' && phoneLabel && (
                <p className="text-xs leading-snug text-slate-400">
                  Linked number: <span className="font-mono text-slate-300">{phoneLabel}</span>
                  {linkedProfile?.pushName ? (
                    <span className="text-slate-500"> · {linkedProfile.pushName}</span>
                  ) : null}
                </p>
              )}
              {engineLabel && (
                <p className="text-xs leading-snug text-slate-600">Engine: {engineLabel}</p>
              )}
            </div>
          </div>
        )}

        {lastRefreshed && (
          <p className="text-[10px] text-slate-700 mt-4">
            Last checked: {lastRefreshed.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* QR Code */}
      {status === 'SCAN_QR_CODE' && qr && (
        <div className="bg-slate-800/60 border border-amber-500/30 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">Scan QR Code</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Open WhatsApp on your phone → Linked Devices → Link a Device → scan this code.
          </p>
          <div className="bg-white rounded-xl p-3 inline-block">
            {qr.startsWith('data:') ? (
              <Image src={qr} alt="WhatsApp QR Code" width={200} height={200} unoptimized />
            ) : (
              <p className="text-xs text-slate-800 font-mono break-all max-w-[200px]">{qr}</p>
            )}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            Page auto-refreshes every 10s. QR codes expire after ~60s.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {(status === 'STOPPED' ||
          status === 'DISCONNECTED' ||
          status === 'UNKNOWN' ||
          status === 'FAILED') && (
          <button
            onClick={() => handleAction('start')}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {actionLoading === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Start Session
          </button>
        )}
        {(status === 'CONNECTED' || status === 'SCAN_QR_CODE' || status === 'FAILED') && (
          <button
            onClick={() => handleAction('restart')}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm font-medium rounded-xl transition-colors"
          >
            {actionLoading === 'restart' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Restart
          </button>
        )}
      </div>

      {/* Info */}
      <div className="mt-8 bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
        <p className="font-medium text-slate-400">How it works</p>
        <p>1. Start the WAHA session — a QR code will appear.</p>
        <p>2. Scan with WhatsApp to link your number.</p>
        <p>3. Incoming WhatsApp messages trigger the WAHA webhook.</p>
        <p>4. AlignCore AI analyzes sentiment and updates relationship health scores in real time.</p>
      </div>
    </div>
  )
}

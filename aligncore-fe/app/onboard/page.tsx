'use client'

import { useState, useRef, useEffect } from 'react'
import { sendChat, ChatMessage } from '@/lib/api'
import { MessageSquare, Send, Loader2, Bot, User, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const WELCOME = `Hi! I'm AlignCore AI. I'll help onboard your startup into our ecosystem.

Let's start — what's your company name and what problem are you solving?`

export default function OnboardPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [completedCompanyId, setCompletedCompanyId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const data = await sendChat(nextMessages, sessionId)
      setSessionId(data.sessionId)
      if (data.is_complete && data.company_id) {
        setCompletedCompanyId(data.company_id)
      }
      setMessages([...nextMessages, { role: 'model', text: data.reply }])
    } catch {
      setMessages([...nextMessages, { role: 'model', text: 'Sorry, I had trouble responding. Please try again.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const allMessages: Array<ChatMessage | { role: 'welcome'; text: string }> = [
    { role: 'welcome', text: WELCOME },
    ...messages,
  ]

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-400" />
          Onboard
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">AI-guided startup onboarding</p>
      </div>

      {/* Success banner */}
      {completedCompanyId && (
        <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4 flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-300">Onboarding complete!</p>
            <p className="text-xs text-emerald-600">Company profile created and saved to the ecosystem.</p>
          </div>
          <Link
            href={`/companies/${completedCompanyId}`}
            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium flex-shrink-0 transition-colors"
          >
            View profile <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Chat window */}
      <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {allMessages.map((msg, i) => {
            const isModel = msg.role === 'model' || msg.role === 'welcome'
            return (
              <div key={i} className={`flex items-start gap-3 ${isModel ? '' : 'flex-row-reverse'}`}>
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    isModel ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  {isModel ? (
                    <Bot className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                {/* Bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isModel
                      ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'
                      : 'bg-indigo-600 text-white rounded-tr-none'
                  }`}
                >
                  {msg.text.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-2' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-none px-4 py-3">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-slate-700/50 px-4 py-3 flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              style={{ maxHeight: 120 }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-700 mt-2">
        <MessageSquare className="w-3 h-3 inline mr-1" />
        Powered by Gemini · Session: {sessionId ? sessionId.slice(0, 8) + '…' : 'new'}
      </p>
    </div>
  )
}

interface HealthScoreProps {
  score: number
  size?: number
}

function scoreColor(score: number) {
  if (score >= 0.7) return { stroke: '#34d399', text: 'text-emerald-400' }
  if (score >= 0.4) return { stroke: '#fbbf24', text: 'text-amber-400' }
  return { stroke: '#f87171', text: 'text-rose-400' }
}

export default function HealthScore({ score, size = 72 }: HealthScoreProps) {
  const pct = Math.round(score * 100)
  const { stroke, text } = scoreColor(score)
  const r = 15.9155
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
        />
        {/* Fill */}
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          className="health-ring"
          style={{ filter: `drop-shadow(0 0 4px ${stroke}80)` }}
        />
      </svg>
      <span className={`absolute text-xs font-bold tabular-nums ${text}`}>{pct}</span>
    </div>
  )
}

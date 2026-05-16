import type { HealthHistory } from '@/lib/types'

interface SparklineProps {
  history: HealthHistory[]
  width?: number
  height?: number
}

export default function HealthSparkline({ history, width = 120, height = 32 }: SparklineProps) {
  if (history.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-slate-700 text-[10px]">no data</div>
  }

  const sorted = [...history].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const scores = sorted.map((h) => h.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 0.01

  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * width
    const y = height - ((s - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const last = scores[scores.length - 1]
  const first = scores[0]
  const rising = last >= first
  const stroke = rising ? '#34d399' : '#f87171'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.join(' ')}
        className="sparkline-path"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.8"
      />
    </svg>
  )
}

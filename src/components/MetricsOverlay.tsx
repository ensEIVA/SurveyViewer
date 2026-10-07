import type { DeckProps } from '@deck.gl/core'
import './MetricsOverlay.css'

// deck.gl doesn't export the DeckMetrics type itself, only via this prop.
export type DeckMetrics = Parameters<NonNullable<DeckProps['_onMetrics']>>[0]

interface Props {
  metrics: DeckMetrics | null
  recentPointCount: number
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
// GPU timing needs a timer-query extension the browser/driver may not
// expose; deck.gl then reports 0, which would read as "free".
const ms = (time: number) => (time > 0 ? `${time.toFixed(1)} ms` : 'n/a')

// Chrome-only, non-standard — undefined elsewhere.
const jsHeap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize

export function MetricsOverlay({ metrics, recentPointCount }: Props) {
  if (!metrics) return null
  const heap = jsHeap()
  const rows: [string, string][] = [
    ['FPS', metrics.fps.toFixed(0)],
    ['CPU / frame', ms(metrics.cpuTimePerFrame)],
    ['GPU / frame', ms(metrics.gpuTimePerFrame)],
    ['Layers drawn', `${metrics.drawLayersCount} / ${metrics.layersCount}`],
    ['GPU memory', mb(metrics.gpuMemory)],
    ['JS heap', heap === undefined ? 'n/a' : mb(heap)],
    ['Recent points', recentPointCount.toLocaleString()],
  ]
  return (
    <dl className="metrics-overlay">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

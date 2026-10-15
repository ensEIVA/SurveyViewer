import { useEffect, useState } from 'react'
import { MEASUREMENT_GAP_FACTOR } from '../config'
import { streamLog, summarize, toCsv, type Gap, type StreamStats } from '../lib/streamStats'
import './MeasurementsPanel.css'

// How often the panel re-reads the log.
const REFRESH_MS = 1_000
// A median latency beyond this can't be a real delay: the sender is almost
// certainly stamping original recording times (a replay) or its clock is off.
const IMPLAUSIBLE_LATENCY_MS = 60 * 60 * 1000

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const time = (ms: number) => new Date(ms).toLocaleTimeString()

function latencyText(latency: StreamStats['latencyMs']) {
  if (!latency) return 'n/a (no timestamp)'
  const text = `med ${secs(latency.median)} · p95 ${secs(latency.p95)} · max ${secs(latency.max)}`
  return latency.median > IMPLAUSIBLE_LATENCY_MS ? `${text} ⚠ implausible, see note` : text
}

function gapsText(gaps: Gap[], hasTimestamps: boolean) {
  if (!hasTimestamps) return 'not measurable'
  if (gaps.length === 0) return 'none'
  const last = gaps[gaps.length - 1]
  return `${gaps.length} · last ${secs(last.durationMs)} at ${time(last.from)}`
}

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `stream-measurements-${new Date().toISOString().replaceAll(':', '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Live measurements of every stream from Nexus, for the office test: rate,
// latency and dropouts, with the caveats that decide whether the numbers mean
// anything. Shared by all scenes, since the log is.
export function MeasurementsPanel({ onClose }: { onClose: () => void }) {
  const [gapFactor, setGapFactor] = useState(MEASUREMENT_GAP_FACTOR)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const streams = [...streamLog.snapshot()]
  const rule = { factor: gapFactor }

  return (
    <section className="measurements-panel" aria-label="Stream measurements">
      <header>
        <strong>Stream measurements</strong>
        <label>
          gap = pause over{' '}
          <input
            id="gap-factor"
            type="number"
            min={1.1}
            step={0.5}
            value={gapFactor}
            onChange={e => {
              const value = Number(e.target.value)
              if (value > 1) setGapFactor(value)
            }}
          />{' '}
          × median interval
        </label>
        <button onClick={() => download(toCsv(streamLog.snapshot()))} disabled={streams.length === 0}>
          Export CSV
        </button>
        <button onClick={() => streamLog.clear()}>Clear</button>
        <button onClick={onClose} aria-label="Close measurements">
          ×
        </button>
      </header>

      {streams.length === 0 ? (
        <p>No stream messages yet. Add a dataset with live points, or a vessel.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Stream</th>
              <th>Msgs</th>
              <th>Rate</th>
              <th>Interval (med)</th>
              <th>Latency ¹</th>
              <th>Arrival gaps ²</th>
              <th>Source gaps ³</th>
            </tr>
          </thead>
          <tbody>
            {streams.map(([name, samples]) => {
              const stats = summarize([...samples], rule)
              const hasTimestamps = stats.latencyMs !== null
              return (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{stats.samples}</td>
                  <td>{stats.ratePerS === null ? '–' : `${stats.ratePerS.toFixed(2)}/s`}</td>
                  <td>{stats.medianIntervalMs === null ? '–' : secs(stats.medianIntervalMs)}</td>
                  <td>{latencyText(stats.latencyMs)}</td>
                  <td>{gapsText(stats.arrivalGaps, true)}</td>
                  <td>{gapsText(stats.measuredGaps, hasTimestamps)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <ol className="measurements-notes">
        <li>
          <strong>Latency = this browser's clock − the sender's measurement timestamp.</strong> Only valid if both
          machines' clocks are synchronised and the sender stamps the real measurement time. A replay that keeps the
          original recording timestamps shows a huge, constant latency: then only the spread (p95 − median) means
          anything. Live points carry no timestamp, so their latency can't be measured.
        </li>
        <li>
          <strong>Arrival gap</strong>: messages stopped reaching the browser for longer than {gapFactor} × the
          stream's median interval — network, Nexus or reconnects. Nexus sends live-point snapshots on its own timer,
          so a pause in the <em>data</em> behind them doesn't show here.
        </li>
        <li>
          <strong>Source gap</strong>: the sender's timestamps jump by more than {gapFactor} × their median interval
          — the source itself dropped data. Only for streams with timestamps (vessels).
        </li>
      </ol>
    </section>
  )
}

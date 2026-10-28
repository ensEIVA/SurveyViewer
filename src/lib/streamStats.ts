// Measurements of the data streams from Nexus, for the office test: how
// late data arrives, and where it drops out. Pure — no React, no deck.gl —
// so it can be unit tested and inspected from a breakpoint.
//
// Two clocks are involved, and only one of them is ours:
// - receivedAt: the browser's clock when a message arrived. Always known.
// - measuredAt: the sender's timestamp of when the data was measured, if
//   the message carries one. Vessel positions carry when they were
//   measured; live points when Nexus took the snapshot.
// Latency is receivedAt - measuredAt, so it is only meaningful if both
// machines' clocks agree and the sender stamps real measurement time. A
// replay that keeps the original recording timestamps shows a huge,
// constant "latency": only its spread (jitter) means anything then.

export interface Sample {
  // Browser clock, ms since epoch.
  receivedAt: number
  // Sender's clock, ms since epoch; null if the message has no timestamp.
  measuredAt: number | null
  // Points in the message, for streams that carry points.
  count?: number
}

// A pause between two consecutive timestamps that is longer than the rule
// allows.
export interface Gap {
  from: number
  to: number
  durationMs: number
  // The pause that counted as a gap: factor x the median interval.
  thresholdMs: number
}

// When a pause counts as a gap: longer than `factor` times the stream's
// median interval. E.g. factor 3 on a 1 Hz stream flags pauses over 3 s.
export interface GapRule {
  factor: number
}

export interface StreamStats {
  samples: number
  // Messages per second over the recorded span; null below two samples.
  ratePerS: number | null
  medianIntervalMs: number | null
  // receivedAt - measuredAt over samples that have measuredAt; null if none.
  latencyMs: { median: number; p95: number; max: number; min: number } | null
  // Pauses in arrival: transport or Nexus dropping out.
  arrivalGaps: Gap[]
  // Pauses in measurement time: the source itself dropping out. Empty for
  // streams without measuredAt.
  measuredGaps: Gap[]
}

// Linear interpolation between closest ranks; `sorted` ascending, non-empty.
export function percentile(sorted: number[], p: number): number {
  const rank = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

const ascending = (a: number, b: number) => a - b

// Gaps in a series of timestamps, in the order given. Needs at least two
// intervals to have a median worth comparing against.
export function findGaps(times: number[], rule: GapRule): Gap[] {
  if (times.length < 3) return []
  const intervals = times.slice(1).map((t, i) => t - times[i])
  const median = percentile([...intervals].sort(ascending), 50)
  const thresholdMs = rule.factor * median
  const gaps: Gap[] = []
  intervals.forEach((durationMs, i) => {
    if (durationMs > thresholdMs) gaps.push({ from: times[i], to: times[i + 1], durationMs, thresholdMs })
  })
  return gaps
}

export function summarize(samples: Sample[], rule: GapRule): StreamStats {
  const arrivals = samples.map(s => s.receivedAt)
  const measured = samples.flatMap(s => (s.measuredAt === null ? [] : [s.measuredAt]))
  const intervals = arrivals.slice(1).map((t, i) => t - arrivals[i]).sort(ascending)
  const span = arrivals.length > 1 ? arrivals[arrivals.length - 1] - arrivals[0] : 0
  const latencies = samples
    .flatMap(s => (s.measuredAt === null ? [] : [s.receivedAt - s.measuredAt]))
    .sort(ascending)
  return {
    samples: samples.length,
    ratePerS: span > 0 ? ((samples.length - 1) * 1000) / span : null,
    medianIntervalMs: intervals.length ? percentile(intervals, 50) : null,
    latencyMs: latencies.length
      ? {
          median: percentile(latencies, 50),
          p95: percentile(latencies, 95),
          max: latencies[latencies.length - 1],
          min: latencies[0],
        }
      : null,
    arrivalGaps: findGaps(arrivals, rule),
    measuredGaps: findGaps(measured, rule),
  }
}

// Oldest samples are dropped beyond this: ~5.5 h of a 1 Hz stream.
const MAX_SAMPLES = 20_000

// Recorded samples per stream, e.g. "vessel:A" or "points:survey-a".
// Module-level so every hook records into the same place; also reachable
// as window.__streamLog from the devtools console.
export class StreamLog {
  private streams = new Map<string, Sample[]>()
  private open = new Set<string>()

  // Claims a name for one open stream. Two panes showing the same dataset
  // each open their own stream; merging their samples would double the rate
  // and hide gaps, so the second gets "name#2". Closing frees the name, and
  // reopening continues its samples (the pause then shows as a gap).
  claim(name: string): string {
    let key = name
    for (let n = 2; this.open.has(key); n++) key = `${name}#${n}`
    this.open.add(key)
    return key
  }

  release(key: string) {
    this.open.delete(key)
  }

  record(stream: string, sample: Sample) {
    let samples = this.streams.get(stream)
    if (!samples) this.streams.set(stream, (samples = []))
    samples.push(sample)
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES)
  }

  // Stream name -> its samples, oldest first. Do not mutate.
  snapshot(): ReadonlyMap<string, readonly Sample[]> {
    return this.streams
  }

  clear() {
    this.streams.clear()
  }
}

export const streamLog = new StreamLog()
;(globalThis as { __streamLog?: StreamLog }).__streamLog = streamLog

const iso = (ms: number | null) => (ms === null ? '' : new Date(ms).toISOString())

// One row per sample, for comparing a test run afterwards. Gaps aren't
// written: they follow from the timestamps under whatever rule is chosen
// then.
export function toCsv(streams: ReadonlyMap<string, readonly Sample[]>): string {
  const rows = ['stream,received_at,measured_at,latency_ms,count']
  for (const [stream, samples] of streams) {
    for (const s of samples) {
      const latency = s.measuredAt === null ? '' : String(s.receivedAt - s.measuredAt)
      // Quoted: vessel ids are free text and could hold a comma.
      rows.push([`"${stream.replaceAll('"', '""')}"`, iso(s.receivedAt), iso(s.measuredAt), latency, s.count ?? ''].join(','))
    }
  }
  return rows.join('\n') + '\n'
}

import { describe, expect, it } from 'vitest'
import { findGaps, percentile, StreamLog, summarize, toCsv, type Sample } from './streamStats'

// 1 Hz timestamps from t0, skipping the given seconds.
const everySecond = (n: number, skip: number[] = [], t0 = 1_000_000) =>
  Array.from({ length: n }, (_, i) => t0 + i * 1000).filter((_, i) => !skip.includes(i))

describe('findGaps', () => {
  it('finds nothing in a steady stream', () => {
    expect(findGaps(everySecond(10), { factor: 3 })).toEqual([])
  })

  it('finds one known dropout exactly once, with its length', () => {
    // Seconds 4-7 missing: a 5 s pause from second 3 to second 8.
    const gaps = findGaps(everySecond(20, [4, 5, 6, 7]), { factor: 3 })
    expect(gaps).toEqual([{ from: 1_003_000, to: 1_008_000, durationMs: 5000, thresholdMs: 3000 }])
  })

  it('finds two separate dropouts as two gaps', () => {
    expect(findGaps(everySecond(30, [5, 6, 7, 20, 21, 22]), { factor: 3 })).toHaveLength(2)
  })

  it('follows the factor: a 3 s pause is a gap at factor 2, not at factor 3', () => {
    const times = everySecond(10, [4, 5])
    expect(findGaps(times, { factor: 2 })).toHaveLength(1)
    expect(findGaps(times, { factor: 3 })).toHaveLength(0)
  })

  it('needs at least two intervals', () => {
    expect(findGaps([0, 10_000], { factor: 3 })).toEqual([])
  })
})

describe('percentile', () => {
  it('interpolates between ranks', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25)
    expect(percentile([10, 20, 30, 40], 100)).toBe(40)
  })
})

describe('summarize', () => {
  it('measures rate and latency from both clocks', () => {
    const samples: Sample[] = everySecond(11).map((t, i) => ({ receivedAt: t, measuredAt: t - (i === 10 ? 900 : 200) }))
    const stats = summarize(samples, { factor: 3 })
    expect(stats.ratePerS).toBe(1)
    expect(stats.latencyMs).toMatchObject({ median: 200, min: 200, max: 900 })
  })

  it('has no latency and no source gaps without measurement times', () => {
    const stats = summarize(
      everySecond(10).map(t => ({ receivedAt: t, measuredAt: null, count: 5 })),
      { factor: 3 },
    )
    expect(stats.latencyMs).toBeNull()
    expect(stats.measuredGaps).toEqual([])
  })

  it('tells a source dropout from a transport dropout', () => {
    // Arrives steadily, but the sender's timestamps skip seconds 4-7.
    const measured = everySecond(20, [4, 5, 6, 7])
    const samples = measured.map((m, i) => ({ receivedAt: 2_000_000 + i * 1000, measuredAt: m }))
    const stats = summarize(samples, { factor: 3 })
    expect(stats.arrivalGaps).toEqual([])
    expect(stats.measuredGaps).toHaveLength(1)
  })
})

describe('StreamLog.claim', () => {
  it('keeps two open streams of the same name apart, and reuses a released name', () => {
    const log = new StreamLog()
    expect(log.claim('points:a')).toBe('points:a')
    expect(log.claim('points:a')).toBe('points:a#2')
    log.release('points:a')
    expect(log.claim('points:a')).toBe('points:a')
  })
})

describe('toCsv', () => {
  it('writes one row per sample, quoting the stream name', () => {
    const csv = toCsv(new Map([['vessel:A,B', [{ receivedAt: 1000, measuredAt: 800 }]]]))
    expect(csv).toBe(
      'stream,received_at,measured_at,latency_ms,count\n' +
        '"vessel:A,B",1970-01-01T00:00:01.000Z,1970-01-01T00:00:00.800Z,200,\n',
    )
  })
})

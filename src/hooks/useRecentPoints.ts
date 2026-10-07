import { useEffect, useState } from 'react'
import { decodeRecentPoints, type RecentPoints } from '../lib/recentPoints'

// Polls the latest not-yet-in-the-tree points. The next request is only
// scheduled once the previous one finishes (setTimeout chain, not
// setInterval): payloads can be several MB, and on a slow link a fixed
// interval would stack up overlapping requests.
export function useRecentPoints(url: string, pollMs: number): RecentPoints | null {
  const [points, setPoints] = useState<RecentPoints | null>(null)

  useEffect(() => {
    // Unmount marks the loop cancelled instead of aborting the request in
    // flight: StrictMode mounts, unmounts and remounts every component in
    // dev, so aborting would cancel the very first request every time. The
    // request just finishes and its result is dropped.
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const buffer = await res.arrayBuffer()
        if (cancelled) return
        setPoints(decodeRecentPoints(buffer))
      } catch (err) {
        if (cancelled) return
        // Keep showing the last good snapshot; the next tick may recover.
        console.warn('[viewer] recent points poll failed', err)
      }
      timer = setTimeout(tick, pollMs)
    }
    tick()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [url, pollMs])

  return points
}

import { useEffect, useState } from 'react'
import { decodeRecentPoints, type RecentPoints } from '../lib/recentPoints'

// Polls the latest not-yet-in-the-tree points. The next request is only
// scheduled once the previous one finishes (setTimeout chain, not
// setInterval): payloads can be several MB, and on a slow link a fixed
// interval would stack up overlapping requests.
export function useRecentPoints(url: string, pollMs: number): RecentPoints | null {
  const [points, setPoints] = useState<RecentPoints | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store', signal: abort.signal })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        setPoints(decodeRecentPoints(await res.arrayBuffer()))
      } catch (err) {
        if (abort.signal.aborted) return
        // Keep showing the last good snapshot; the next tick may recover.
        console.warn('[viewer] recent points poll failed', err)
      }
      timer = setTimeout(tick, pollMs)
    }
    tick()

    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [url, pollMs])

  return points
}

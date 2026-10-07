import { useEffect, useState } from 'react'
import { decodeLivePoints, type LivePoints } from '../lib/livePoints'
import { nexusClient } from '../services/nexusClient'

// Polls Nexus for the latest not-yet-in-the-tree points. The next request is
// only scheduled once the previous one finishes (setTimeout chain, not
// setInterval): a snapshot can be several MB, and on a slow link a fixed
// interval would stack up overlapping requests.
export function useLivePoints(pollMs: number): LivePoints | null {
  const [points, setPoints] = useState<LivePoints | null>(null)

  useEffect(() => {
    // Unmount marks the loop cancelled instead of aborting the request in
    // flight: StrictMode mounts, unmounts and remounts every component in
    // dev, so aborting would cancel the very first request every time. The
    // request just finishes and its result is dropped.
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await nexusClient.getLivePoints({})
        console.log('[viewer] Got live points response', res)
        if (cancelled) return
        setPoints(decodeLivePoints(res))
      } catch (err) {
        if (cancelled) return
        // Keep showing the last good snapshot; the next tick may recover.
        console.warn('[viewer] GetLivePoints failed', err)
      }
      timer = setTimeout(tick, pollMs)
    }
    tick()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pollMs])

  return points
}

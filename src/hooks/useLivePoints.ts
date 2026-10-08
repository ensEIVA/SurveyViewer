import { useEffect, useState } from 'react'
import { decodeLivePoints, type LivePoints } from '../lib/livePoints'
import { nexusClient } from '../services/nexusClient'

export interface LivePointsStream {
  // The newest snapshot; kept while reconnecting, so the overlay doesn't blank.
  points: LivePoints | null
  // False while the stream is down and waiting to reopen.
  connected: boolean
}

// Reopen delays after the stream ends or fails: doubles each failed attempt,
// back to the start as soon as a snapshot arrives.
const RECONNECT_MIN_MS = 1_000
const RECONNECT_MAX_MS = 10_000

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(id)
      resolve()
    })
  })

// Subscribes to Nexus's live-points stream: Nexus sends the latest snapshot
// straight away, then a new one on its own timer. If the stream ever ends
// (Nexus restart, network drop) it's reopened with backoff.
//
// Unlike the polling hooks, unmount aborts the stream: an open stream is a
// held connection, and leaving it running would leak one per remount. In dev,
// StrictMode's mount-unmount-remount therefore opens and immediately cancels a
// first stream — Nexus has to tolerate that, as it must any closed tab.
// `enabled: false` closes the stream (or never opens it): a pane without live
// points holds no connection and receives nothing.
export function useLivePoints(datasetId: string, enabled: boolean): LivePointsStream {
  const [points, setPoints] = useState<LivePoints | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    const { signal } = abort

    const run = async () => {
      let delay = RECONNECT_MIN_MS
      while (!signal.aborted) {
        try {
          for await (const res of nexusClient.getLivePoints({ datasetId }, { signal })) {
            setPoints(decodeLivePoints(res))
            setConnected(true)
            delay = RECONNECT_MIN_MS
          }
          // Ended cleanly (e.g. Nexus shutting down): reopen like any failure.
        } catch (err) {
          if (signal.aborted) return
          console.warn('[viewer] GetLivePoints stream failed', err)
        }
        if (signal.aborted) return
        setConnected(false)
        await sleep(delay, signal)
        delay = Math.min(delay * 2, RECONNECT_MAX_MS)
      }
    }
    run()

    return () => abort.abort()
  }, [datasetId, enabled])

  // Hide the last snapshot while switched off rather than clearing state.
  return enabled ? { points, connected } : { points: null, connected: false }
}

import { useEffect, useState } from 'react'
import { decodeLivePoints, type LivePoints } from '../lib/livePoints'
import { runReconnectingStream } from '../lib/reconnectingStream'
import { streamLog } from '../lib/streamStats'
import { nexusClient } from '../services/nexusClient'

export interface LivePointsStream {
  // The newest snapshot; kept while reconnecting, so the overlay doesn't blank.
  points: LivePoints | null
  // False while the stream is down and waiting to reopen.
  connected: boolean
}

// Subscribes to Nexus's live-points stream: Nexus sends the latest snapshot
// straight away, then a new one on its own timer. If the stream ever ends
// (Nexus restart, network drop) it's reopened with backoff.
//
// Unlike the polling hooks, unmount aborts the stream: an open stream is a
// held connection, and leaving it running would leak one per remount. In dev,
// StrictMode's mount-unmount-remount therefore opens and immediately cancels a
// first stream — Nexus has to tolerate that, as it must any closed tab.
//
// `enabled: false` closes the stream (or never opens it): a pane without live
// points holds no connection and receives nothing.
export function useLivePoints(datasetId: string, enabled: boolean): LivePointsStream {
  const [points, setPoints] = useState<LivePoints | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    const logKey = streamLog.claim(`points:${datasetId}`)
    runReconnectingStream({
      open: signal => nexusClient.getLivePoints({ datasetId }, { signal }),
      onMessage: res => {
        // No measuredAt: the contract gives live points no timestamp.
        streamLog.record(logKey, { receivedAt: Date.now(), measuredAt: null, count: res.points?.count ?? 0 })
        setPoints(decodeLivePoints(res))
        setConnected(true)
      },
      onDisconnected: () => setConnected(false),
      label: 'GetLivePoints',
      signal: abort.signal,
    })
    return () => {
      abort.abort()
      streamLog.release(logKey)
    }
  }, [datasetId, enabled])

  // Hide the last snapshot while switched off rather than clearing state.
  return enabled ? { points, connected } : { points: null, connected: false }
}

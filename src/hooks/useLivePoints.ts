import { useEffect, useState } from 'react'
import { LivePointsSnapshot } from '../gen/nexus/v1/nexus_topics.fletcher'
import { LIVE_POINTS_TOPIC } from '../services/topics'
import { decodeLivePoints, type LivePoints } from '../lib/livePoints'
import { streamLog } from '../lib/streamStats'
import { gateway } from '../services/gateway'

export interface LivePointsStream {
  // The newest snapshot; kept while reconnecting, so the overlay doesn't blank.
  points: LivePoints | null
  // False while the gateway connection is down.
  connected: boolean
}

// Follows one dataset on the Fletcher gateway's live-points topic: Nexus
// publishes a snapshot of every dataset on its own timer (one second by
// default), so rows for other datasets are skipped, and nothing shows until
// the next snapshot.
//
// `enabled: false` drops the subscription (or never makes it): a pane
// without live points receives nothing for it. Rows still reach the browser
// while any other pane shows live points of any dataset.
export function useLivePoints(datasetId: string, enabled: boolean): LivePointsStream {
  const [points, setPoints] = useState<LivePoints | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const logKey = streamLog.claim(`points:${datasetId}`)
    const unsubscribe = gateway.subscribe(
      LIVE_POINTS_TOPIC,
      LivePointsSnapshot,
      row => {
        if (row.dataset_id !== datasetId) return
        // Nanoseconds since the epoch, by Nexus's clock; 0 means unset.
        const takenAt = row.taken_at > 0n ? Number(row.taken_at / 1_000_000n) : null
        streamLog.record(logKey, { receivedAt: Date.now(), measuredAt: takenAt, count: row.point_count })
        try {
          setPoints(decodeLivePoints(row))
        } catch (err) {
          console.warn('[viewer] Malformed live points snapshot', err)
        }
      },
      setConnected,
    )
    return () => {
      unsubscribe()
      streamLog.release(logKey)
    }
  }, [datasetId, enabled])

  // Hide the last snapshot while switched off rather than clearing state.
  return enabled ? { points, connected } : { points: null, connected: false }
}

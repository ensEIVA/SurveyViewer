import { useEffect, useState } from 'react'
import { VesselPosition as VesselPositionRow } from '../gen/nexus/v1/nexus_topics.fletcher'
import { VESSEL_POSITION_TOPIC } from '../services/topics'
import { streamLog } from '../lib/streamStats'
import { gateway } from '../services/gateway'

export interface VesselPosition {
  longitude: number
  latitude: number
  height: number
  // Degrees: roll positive starboard down, pitch positive bow up, heading
  // clockwise from true north — the contract's maritime convention.
  roll: number
  pitch: number
  heading: number
  // When it was measured; null if Nexus didn't say.
  measuredAt: Date | null
}

export interface VesselPositionStream {
  // The newest position; kept while reconnecting.
  position: VesselPosition | null
  // False while the gateway connection is down.
  connected: boolean
}

// Follows one vessel on the Fletcher gateway's vessel-positions topic. The
// topic carries every vessel, so rows for other vessels are skipped. Nexus
// publishes a position only when it changes, so nothing shows until the
// vessel's next update. The subscription is dropped on unmount.
export function useVesselPosition(vesselId: string): VesselPositionStream {
  const [position, setPosition] = useState<VesselPosition | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const logKey = streamLog.claim(`vessel:${vesselId}`)
    const unsubscribe = gateway.subscribe(
      VESSEL_POSITION_TOPIC,
      VesselPositionRow,
      row => {
        if (row.vessel_id !== vesselId) return
        // Nanoseconds since the epoch; 0 means unset.
        const measuredAt = row.timestamp > 0n ? new Date(Number(row.timestamp / 1_000_000n)) : null
        streamLog.record(logKey, { receivedAt: Date.now(), measuredAt: measuredAt?.getTime() ?? null })
        setPosition({
          longitude: row.pos_longitude,
          latitude: row.pos_latitude,
          height: row.pos_height,
          roll: row.rot_roll,
          pitch: row.rot_pitch,
          heading: row.rot_yaw,
          measuredAt,
        })
      },
      setConnected,
    )
    return () => {
      unsubscribe()
      streamLog.release(logKey)
    }
  }, [vesselId])

  return { position, connected }
}

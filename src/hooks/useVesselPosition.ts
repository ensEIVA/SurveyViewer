import { useEffect, useState } from 'react'
import { timestampDate } from '@bufbuild/protobuf/wkt'
import { runReconnectingStream } from '../lib/reconnectingStream'
import { nexusClient } from '../services/nexusClient'

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
  // False while the stream is down and waiting to reopen.
  connected: boolean
}

// Subscribes to one vessel's position stream, reopening it with backoff if
// it ends. Aborted on unmount, like useLivePoints and for the same reasons.
export function useVesselPosition(vesselId: string): VesselPositionStream {
  const [position, setPosition] = useState<VesselPosition | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const abort = new AbortController()
    runReconnectingStream({
      open: signal => nexusClient.getVesselPosition({ vesselId }, { signal }),
      onMessage: res => {
        setPosition({
          longitude: res.posLongitude,
          latitude: res.posLatitude,
          height: res.posHeight,
          roll: res.rotRoll,
          pitch: res.rotPitch,
          heading: res.rotYaw,
          measuredAt: res.timestamp ? timestampDate(res.timestamp) : null,
        })
        setConnected(true)
      },
      onDisconnected: () => setConnected(false),
      label: 'GetVesselPosition',
      signal: abort.signal,
    })
    return () => abort.abort()
  }, [vesselId])

  return { position, connected }
}

import { useEffect, useState } from 'react'
import type { VesselDescriptor } from '../gen/nexus/v1/nexus_service_pb'
import { nexusClient } from '../services/nexusClient'

export type Vessels =
  | { state: 'loading' }
  | { state: 'ready'; vessels: VesselDescriptor[] }
  | { state: 'error'; message: string }

// The vessels Nexus can report positions for, asked once on mount.
export function useVessels(): Vessels {
  const [result, setResult] = useState<Vessels>({ state: 'loading' })

  useEffect(() => {
    // Cancelled flag rather than aborting: see useNodeDescriptionEndpoint.
    let cancelled = false
    nexusClient
      .getAvailableVessels({})
      .then(res => {
        if (!cancelled) setResult({ state: 'ready', vessels: res.vesselDescriptors })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('[viewer] GetAvailableVessels failed', err)
        setResult({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return result
}

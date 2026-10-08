import { useEffect, useState } from 'react'
import type { DatasetDescriptor } from '../gen/nexus/v1/nexus_service_pb'
import { nexusClient } from '../services/nexusClient'

export type Datasets =
  | { state: 'loading' }
  | { state: 'ready'; datasets: DatasetDescriptor[] }
  | { state: 'error'; message: string }

// The datasets Nexus can show, asked once on mount.
export function useDatasets(): Datasets {
  const [result, setResult] = useState<Datasets>({ state: 'loading' })

  useEffect(() => {
    // Cancelled flag rather than aborting: see useNodeDescriptionEndpoint.
    let cancelled = false
    nexusClient
      .getAvailableDatasets({})
      .then(res => {
        if (!cancelled) setResult({ state: 'ready', datasets: res.datasetDescriptors })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('[viewer] GetAvailableDatasets failed', err)
        setResult({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return result
}

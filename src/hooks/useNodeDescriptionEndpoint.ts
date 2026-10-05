import { useEffect, useState } from 'react'
import { API_URL } from '../config'
import { nexusClient } from '../services/nexusClient'

export type NodeDescriptionEndpoint =
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  | { state: 'error'; message: string }

// Asks Nexus once where a node's description (tileset.json) lives.
export function useNodeDescriptionEndpoint(nodeId: number): NodeDescriptionEndpoint {
  const [result, setResult] = useState<NodeDescriptionEndpoint>({ state: 'loading' })

  useEffect(() => {
    const abort = new AbortController()
    nexusClient
      .getNodeDescriptionEndpoint({ nodeId }, { signal: abort.signal })
      .then(res => {
        // Resolved against Nexus's own url, so a relative endpoint
        // ("/tileset.json") works as well as an absolute one.
        setResult({ state: 'ready', url: new URL(res.nodeDescriptionEndpoint, API_URL).toString() })
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return
        console.error('[viewer] GetNodeDescriptionEndpoint failed', err)
        setResult({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => abort.abort()
  }, [nodeId])

  return result
}

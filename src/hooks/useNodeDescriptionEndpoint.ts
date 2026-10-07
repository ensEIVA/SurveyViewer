import { useEffect, useState } from 'react'
import { API_URL } from '../config'
import { nexusClient } from '../services/nexusClient'

export type NodeDescriptionEndpoint =
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  | { state: 'error'; message: string }

// Asks Nexus where a node's description (tileset.json) lives, and asks
// again every pollMs so a url that changes on the Nexus side is picked up.
// setTimeout chain rather than setInterval: the next request is only
// scheduled once the previous one has finished, so a slow Nexus never has
// overlapping calls stacked up.
export function useNodeDescriptionEndpoint(nodeId: string, pollMs: number): NodeDescriptionEndpoint {
  const [result, setResult] = useState<NodeDescriptionEndpoint>({ state: 'loading' })
  useEffect(() => {
    // Unmount marks the loop cancelled instead of aborting the request in
    // flight: StrictMode mounts, unmounts and remounts every component in
    // dev, so aborting would cancel the very first request every time. The
    // request just finishes and its result is dropped.
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await nexusClient.getNodeDescriptionEndpoint({ nodeId })
        // Resolved against Nexus's own url, so a relative endpoint
        // ("/tileset.json") works as well as an absolute one.
        if (cancelled) return
        const url = new URL(res.nodeDescriptionEndpoint, API_URL).toString()
        console.log('[viewer] Nexus node description endpoint', { nodeId, raw: res.nodeDescriptionEndpoint, url })
        // Same url as last time → keep the same object, so nothing
        // downstream re-renders or restarts its tileset polling.
        setResult(prev => (prev.state === 'ready' && prev.url === url ? prev : { state: 'ready', url }))
      } catch (err) {
        if (cancelled) return
        console.error('[viewer] GetNodeDescriptionEndpoint failed', err)
        // Once we have a url, a failed re-check keeps it — the tiles may
        // still be reachable even if this one call failed.
        setResult(prev =>
          prev.state === 'ready'
            ? prev
            : { state: 'error', message: err instanceof Error ? err.message : String(err) },
        )
      }
      timer = setTimeout(tick, pollMs)
    }
    tick()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nodeId, pollMs])

  return result
}

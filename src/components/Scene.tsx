import { useState } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, type MapViewState } from '@deck.gl/core'
import { API_URL, NODE_ENDPOINT_POLL_MS, RECENT_POINTS_POLL_MS, ROOT_NODE_ID, TILESET_POLL_MS } from '../config'
import { useLiveTileset } from '../hooks/useLiveTileset'
import { useNodeDescriptionEndpoint } from '../hooks/useNodeDescriptionEndpoint'
import { useRecentPoints } from '../hooks/useRecentPoints'
import { makeRecentPointsLayer } from '../layers/recentPointsLayer'
import { makeTilesetLayer } from '../layers/tilesetLayer'
import { MetricsOverlay, type DeckMetrics } from './MetricsOverlay'
import { StatusOverlay } from './StatusOverlay'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 0,
  pitch: 45,
  bearing: 0,
}

const MAP_VIEW = new MapView({ repeat: true })

const RECENT_POINTS_URL = `${API_URL}/recent-points.bin`

// Controlled view state (rather than DeckGL's initialViewState) so the
// camera can be re-centered from code once a tileset reports where its
// data actually is.
export function Scene() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [hasCenteredCamera, setHasCenteredCamera] = useState(false)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [errorUrl, setErrorUrl] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<DeckMetrics | null>(null)
  const endpoint = useNodeDescriptionEndpoint(ROOT_NODE_ID, NODE_ENDPOINT_POLL_MS)
  const tilesets = useLiveTileset(endpoint.state === 'ready' ? endpoint.url : null, TILESET_POLL_MS)
  const latest = tilesets.at(-1)
  const recentPoints = useRecentPoints(RECENT_POINTS_URL, RECENT_POINTS_POLL_MS)

  const tilesetLayers = tilesets.map(entry =>
    makeTilesetLayer(entry, {
      onTilesetLoad: tileset3d => {
        const { cartographicCenter, zoom } = tileset3d
        if (cartographicCenter && !hasCenteredCamera) {
          setHasCenteredCamera(true)
          setViewState(vs => ({
            ...vs,
            longitude: cartographicCenter[0],
            latitude: cartographicCenter[1],
            zoom: Number.isFinite(zoom) ? zoom : vs.zoom,
          }))
        }
        setLoadedUrl(entry.url)
      },
      onTileError: (_tile, tileUrl, message) => {
        console.error('[viewer] tile error', tileUrl, message)
        setErrorUrl(entry.url)
      },
    }),
  )
  // Drawn last so it sits on top of the tiles.
  const layers = recentPoints ? [...tilesetLayers, makeRecentPointsLayer(recentPoints)] : tilesetLayers

  let status = `asking Nexus for node ${ROOT_NODE_ID}…`
  if (endpoint.state === 'error') status = `Nexus: ${endpoint.message}`
  else if (latest) {
    if (errorUrl === latest.url) status = `${latest.label} — tile error, see console`
    else if (loadedUrl === latest.url) status = `${latest.label} — loaded`
    else status = `${latest.label} — loading…`
  }

  return (
    <>
      <DeckGL
        views={MAP_VIEW}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as MapViewState)}
        controller
        layers={layers}
        // deck.gl mutates one metrics object in place, so copy it — otherwise
        // React sees the same reference and never re-renders.
        _onMetrics={m => setMetrics({ ...m })}
      />
      <StatusOverlay text={status} />
      <MetricsOverlay metrics={metrics} recentPointCount={recentPoints?.count ?? 0} />
    </>
  )
}

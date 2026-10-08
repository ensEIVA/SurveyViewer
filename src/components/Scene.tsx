import { useEffect, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, type MapViewState } from '@deck.gl/core'
import type { Tile3DLayerProps } from '@deck.gl/geo-layers'
import { NODE_ENDPOINT_POLL_MS, ROOT_NODE_ID, TILESET_POLL_MS } from '../config'
import { useColorModes } from '../hooks/useColorModes'
import { useLiveTileset } from '../hooks/useLiveTileset'
import { useNodeDescriptionEndpoint } from '../hooks/useNodeDescriptionEndpoint'
import { useLivePoints } from '../hooks/useLivePoints'
import { makeLivePointsLayers } from '../layers/livePointsLayer'
import { makeTilesetLayer } from '../layers/tilesetLayer'
import { ColorControls } from './ColorControls'
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

// How often the off-screen tileset is checked for being fully loaded.
const SWAP_CHECK_MS = 100

type Tileset3D = Parameters<NonNullable<Tile3DLayerProps['onTilesetLoad']>>[0]

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
  const { front, back, promoteBack, refresh: refreshTileset } = useLiveTileset(endpoint.state === 'ready' ? endpoint.url : null, TILESET_POLL_MS)
  // The back slot's loaded Tileset3D, so its readiness can be checked after
  // every frame. Tagged with its url: a stale one must never be promoted.
  const [backTileset, setBackTileset] = useState<{ url: string; tileset3d: Tileset3D } | null>(null)
  const { points: livePoints, connected: liveConnected } = useLivePoints()
  const colorModes = useColorModes()

  const makeSlotLayer = (slot: NonNullable<typeof front>, offscreen: boolean) =>
    makeTilesetLayer(slot, offscreen, {
      onTilesetLoad: tileset3d => {
        if (offscreen) setBackTileset({ url: slot.url, tileset3d })
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
        setLoadedUrl(slot.url)
      },
      onTileError: (_tile, tileUrl, message) => {
        console.error('[viewer] tile error', tileUrl, message)
        setErrorUrl(slot.url)
      },
    })
  // Back first, so it's drawn underneath; it's transparent anyway.
  const tilesetLayers = [back && makeSlotLayer(back, true), front && makeSlotLayer(front, false)].filter(
    layer => layer !== null,
  )

  // isLoaded(): every tile the current camera needs is in. Polled on a timer
  // rather than checked in onAfterRender or onTileLoad: isLoaded() only turns
  // true asynchronously after the last tile lands, and deck.gl only redraws
  // when something changes — so a redraw-driven check can miss it and leave
  // the swap (and with it every later poll) stuck until the camera moves.
  const backTilesetForSwap = back && backTileset?.url === back.url ? backTileset.tileset3d : null
  useEffect(() => {
    if (!backTilesetForSwap) return
    const id = setInterval(() => {
      if (!backTilesetForSwap.isLoaded()) return
      setBackTileset(null)
      promoteBack()
    }, SWAP_CHECK_MS)
    return () => clearInterval(id)
  }, [backTilesetForSwap, promoteBack])
  // Drawn last so it sits on top of the tiles.
  const layers = livePoints ? [...tilesetLayers, ...makeLivePointsLayers(livePoints)] : tilesetLayers

  let status = `asking Nexus for node ${ROOT_NODE_ID}…`
  if (endpoint.state === 'error') status = `Nexus: ${endpoint.message}`
  else if (front) {
    if (errorUrl === front.url) status = `${front.label} — tile error, see console`
    else if (loadedUrl === front.url) status = `${front.label} — loaded`
    else status = `${front.label} — loading…`
    if (back) status += ` | next: ${back.label} loading off-screen…`
  }
  if (livePoints && !liveConnected) status += ' | live points: reconnecting…'

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
      {/* Tiles are coloured by Nexus, so a new choice needs a tileset reload
          to show; live points pick it up on their next poll anyway. */}
      <ColorControls modes={colorModes} onChanged={refreshTileset} />
      <MetricsOverlay metrics={metrics} livePointCount={livePoints?.points.count ?? 0} />
    </>
  )
}

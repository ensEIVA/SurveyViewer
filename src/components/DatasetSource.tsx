import { memo, useEffect, useMemo, useState } from 'react'
import type { Layer } from '@deck.gl/core'
import type { Tile3DLayerProps } from '@deck.gl/geo-layers'
import { NODE_ENDPOINT_POLL_MS, ROOT_NODE_ID, TILESET_POLL_MS } from '../config'
import { useLiveTileset, type TilesetSlot } from '../hooks/useLiveTileset'
import { useNodeDescriptionEndpoint } from '../hooks/useNodeDescriptionEndpoint'
import { useLivePoints } from '../hooks/useLivePoints'
import { makeLivePointsLayers } from '../layers/livePointsLayer'
import { makeTilesetLayer } from '../layers/tilesetLayer'

// How often the off-screen tileset is checked for being fully loaded.
const SWAP_CHECK_MS = 100

type Tileset3D = Parameters<NonNullable<Tile3DLayerProps['onTilesetLoad']>>[0]

// What one dataset contributes to its scene.
export interface SourceReport {
  layers: Layer[]
  status: string
  livePointCount: number
  // Vessels only: where it is now, for the camera to follow.
  position?: { longitude: number; latitude: number }
}

interface Props {
  datasetId: string
  liveEnabled: boolean
  // Changes when the shared colour mode changes, to reload tiles now.
  colorVersion: number
  // Null once this source goes away. Must be stable (useCallback): this
  // component is memoised so camera moves in the scene don't re-render it.
  onReport: (datasetId: string, report: SourceReport | null) => void
  // Where this dataset's tileset turned out to be, for centring the camera.
  onTilesetCenter: (longitude: number, latitude: number, zoom: number) => void
}

// One dataset's data in a scene: its double-buffered tileset and, if
// enabled, its live-points stream. Renders nothing itself — React hooks
// can't be called in a loop over a scene's datasets, so each dataset gets
// its own component, which reports its layers up to the Scene drawing them.
// Mounted with key={datasetId}, so a different dataset starts over.
export const DatasetSource = memo(function DatasetSource({
  datasetId,
  liveEnabled,
  colorVersion,
  onReport,
  onTilesetCenter,
}: Props) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [errorUrl, setErrorUrl] = useState<string | null>(null)
  const endpoint = useNodeDescriptionEndpoint(datasetId, ROOT_NODE_ID, NODE_ENDPOINT_POLL_MS)
  const { front, back, promoteBack } = useLiveTileset(
    endpoint.state === 'ready' ? endpoint.url : null,
    TILESET_POLL_MS,
    colorVersion,
  )
  // The back slot's loaded Tileset3D, so its readiness can be checked.
  // Tagged with its url: a stale one must never be promoted.
  const [backTileset, setBackTileset] = useState<{ url: string; tileset3d: Tileset3D } | null>(null)
  const { points: livePoints, connected: liveConnected } = useLivePoints(datasetId, liveEnabled)

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

  const layers = useMemo(() => {
    const makeSlotLayer = (slot: TilesetSlot, offscreen: boolean) =>
      makeTilesetLayer(datasetId, slot, offscreen, {
        onTilesetLoad: tileset3d => {
          if (offscreen) setBackTileset({ url: slot.url, tileset3d })
          const { cartographicCenter, zoom } = tileset3d
          if (cartographicCenter) onTilesetCenter(cartographicCenter[0], cartographicCenter[1], zoom)
          setLoadedUrl(slot.url)
        },
        onTileError: (_tile, tileUrl, message) => {
          console.error('[viewer] tile error', tileUrl, message)
          setErrorUrl(slot.url)
        },
      })
    // Back first, so it's drawn underneath; it's transparent anyway.
    const tiles: Layer[] = [back && makeSlotLayer(back, true), front && makeSlotLayer(front, false)].filter(
      layer => layer !== null,
    )
    // Live points last, so they sit on top of the tiles.
    return livePoints ? [...tiles, ...makeLivePointsLayers(datasetId, livePoints)] : tiles
  }, [datasetId, front, back, livePoints, onTilesetCenter])

  let status = `asking Nexus for node ${ROOT_NODE_ID}…`
  if (endpoint.state === 'error') status = `Nexus: ${endpoint.message}`
  else if (front) {
    if (errorUrl === front.url) status = `${front.label} — tile error, see console`
    else if (loadedUrl === front.url) status = `${front.label} — loaded`
    else status = `${front.label} — loading…`
    if (back) status += ` | next: ${back.label} loading off-screen…`
  }
  if (livePoints && !liveConnected) status += ' | live points: reconnecting…'
  const livePointCount = livePoints?.points.count ?? 0

  useEffect(() => {
    onReport(datasetId, { layers, status, livePointCount })
  }, [datasetId, layers, status, livePointCount, onReport])
  useEffect(() => () => onReport(datasetId, null), [datasetId, onReport])

  return null
})

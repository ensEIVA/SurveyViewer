import { useState } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, type MapViewState } from '@deck.gl/core'
import { API_URL, TILESET_POLL_MS } from '../config'
import { useLiveTileset } from '../hooks/useLiveTileset'
import { makeTilesetLayer } from '../layers/tilesetLayer'
import { StatusOverlay } from './StatusOverlay'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 0,
  pitch: 45,
  bearing: 0,
}

const MAP_VIEW = new MapView({ repeat: true })

const TILESET_URL = `${API_URL}/tileset.json`

// Controlled view state (rather than DeckGL's initialViewState) so the
// camera can be re-centered from code once a tileset reports where its
// data actually is.
export function Scene() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [hasCenteredCamera, setHasCenteredCamera] = useState(false)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [errorUrl, setErrorUrl] = useState<string | null>(null)
  const tilesets = useLiveTileset(TILESET_URL, TILESET_POLL_MS)
  const latest = tilesets.at(-1)

  const layers = tilesets.map(entry =>
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

  let status = 'waiting for tileset…'
  if (latest) {
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
      />
      <StatusOverlay text={status} />
    </>
  )
}

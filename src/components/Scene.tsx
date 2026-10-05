import { useState } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, type MapViewState } from '@deck.gl/core'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 0,
  pitch: 45,
  bearing: 0,
}

const MAP_VIEW = new MapView({ repeat: true })

// Controlled view state (rather than DeckGL's initialViewState) so the
// camera can later be re-centered from code once a tileset reports where
// its data actually is.
export function Scene() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)

  return (
    <DeckGL
      views={MAP_VIEW}
      viewState={viewState}
      onViewStateChange={({ viewState }) => setViewState(viewState as MapViewState)}
      controller
      layers={[]}
    />
  )
}

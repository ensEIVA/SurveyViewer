import { useCallback, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, type MapViewState } from '@deck.gl/core'
import { BASEMAP_ATTRIBUTION, makeBasemapLayer } from '../layers/basemapLayer'
import { CameraOverlay } from './CameraOverlay'
import { DatasetSource, type SourceReport } from './DatasetSource'
import { MetricsOverlay, type DeckMetrics } from './MetricsOverlay'
import { StatusOverlay } from './StatusOverlay'
import './Scene.css'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 0,
  pitch: 45,
  bearing: 0,
}

const MAP_VIEW = new MapView({ repeat: true })

export interface SceneSource {
  datasetId: string
  // For the status overlay.
  name: string
  // Whether this dataset's live-points stream is subscribed to.
  live: boolean
}

interface Props {
  sources: SceneSource[]
  // Changes when the shared colour mode changes, to reload tiles now.
  colorVersion: number
}

// One 3D view drawing one or more datasets together. Several scenes can be
// on screen, each fully independent: own camera, own datasets, own streams.
//
// Controlled view state (rather than DeckGL's initialViewState) so the
// camera can be re-centred from code once a tileset reports where its data
// actually is.
export function Scene({ sources, colorVersion }: Props) {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [metrics, setMetrics] = useState<DeckMetrics | null>(null)
  const [reports, setReports] = useState<Record<string, SourceReport>>({})
  // One per scene: a layer instance can't be shared between DeckGL canvases.
  const basemap = useMemo(() => makeBasemapLayer(), [])

  const onReport = useCallback((datasetId: string, report: SourceReport | null) => {
    setReports(prev => {
      const next = { ...prev }
      if (report) next[datasetId] = report
      else delete next[datasetId]
      return next
    })
  }, [])

  // Centre on the first tileset to load, once: later datasets, and later
  // polls, mustn't yank the camera away from wherever the user moved it.
  const hasCenteredCamera = useRef(false)
  const onTilesetCenter = useCallback((longitude: number, latitude: number, zoom: number) => {
    if (hasCenteredCamera.current) return
    hasCenteredCamera.current = true
    setViewState(vs => ({ ...vs, longitude, latitude, zoom: Number.isFinite(zoom) ? zoom : vs.zoom }))
  }, [])

  // Basemap first: it must be drawn behind everything (see makeBasemapLayer).
  const layers = [basemap, ...sources.flatMap(s => reports[s.datasetId]?.layers ?? [])]
  const status =
    sources.length === 0
      ? 'no dataset — add one above'
      : sources.map(s => `${s.name}: ${reports[s.datasetId]?.status ?? 'starting…'}`).join('\n')
  const livePointCount = sources.reduce((sum, s) => sum + (reports[s.datasetId]?.livePointCount ?? 0), 0)

  return (
    <>
      {sources.map(s => (
        <DatasetSource
          key={s.datasetId}
          datasetId={s.datasetId}
          liveEnabled={s.live}
          colorVersion={colorVersion}
          onReport={onReport}
          onTilesetCenter={onTilesetCenter}
        />
      ))}
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
      <CameraOverlay viewState={viewState} />
      <MetricsOverlay metrics={metrics} livePointCount={livePointCount} />
      <div className="basemap-attribution">{BASEMAP_ATTRIBUTION}</div>
    </>
  )
}

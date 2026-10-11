import type { DatasetDescriptor } from '../gen/nexus/v1/nexus_service_pb'
import type { Datasets } from '../hooks/useDatasets'
import type { Vessels } from '../hooks/useVessels'
import { DatasetPicker } from './DatasetPicker'
import { Scene, type SceneSource, type SceneVessel } from './Scene'
import './ScenePane.css'

export interface SourceConfig {
  // Null until chosen: falls back to the first dataset not yet in the pane.
  datasetId: string | null
  live: boolean
}

export interface PaneConfig {
  id: string
  sources: SourceConfig[]
  // Vessel ids shown in this pane.
  vessels: string[]
  // The vessel the camera softly follows, if any; one of `vessels`.
  followVesselId: string | null
}

interface Props {
  pane: PaneConfig
  datasets: Datasets
  vessels: Vessels
  colorVersion: number
  onChange: (pane: PaneConfig) => void
  // Absent when this is the last pane, which can't be closed.
  onClose?: () => void
}

// Each configured source's actual dataset: the chosen one if Nexus still
// offers it, else the first one not already in this pane (a remembered id can
// go stale when datasets come and go). A scene shows each dataset at most
// once, so duplicates and leftovers are dropped.
function resolveSources(sources: SourceConfig[], available: DatasetDescriptor[]) {
  const used = new Set<string>()
  return sources.flatMap((source, index) => {
    const chosen = available.find(d => d.datasetId === source.datasetId && !used.has(d.datasetId))
    const dataset = chosen ?? available.find(d => !used.has(d.datasetId))
    if (!dataset) return []
    used.add(dataset.datasetId)
    return [{ index, source, dataset }]
  })
}

// One scene plus its own controls: which datasets it draws (and for each,
// whether to stream its live points) and which vessels. Nothing here is shared
// with other panes.
export function ScenePane({ pane, datasets, vessels, colorVersion, onChange, onClose }: Props) {
  const available = datasets.state === 'ready' ? datasets.datasets : []
  const resolved = resolveSources(pane.sources, available)
  const usedIds = new Set(resolved.map(r => r.dataset.datasetId))
  const unused = available.filter(d => !usedIds.has(d.datasetId))

  const updateSource = (index: number, change: Partial<SourceConfig>) =>
    onChange({ ...pane, sources: pane.sources.map((s, i) => (i === index ? { ...s, ...change } : s)) })
  const removeSource = (index: number) => onChange({ ...pane, sources: pane.sources.filter((_, i) => i !== index) })
  const addSource = () =>
    unused[0] && onChange({ ...pane, sources: [...pane.sources, { datasetId: unused[0].datasetId, live: true }] })

  const sceneSources: SceneSource[] = resolved.map(({ source, dataset }) => ({
    datasetId: dataset.datasetId,
    name: dataset.displayName || dataset.datasetId,
    live: source.live,
  }))

  // Vessels Nexus still offers, each at most once; remembered ids that went
  // stale are skipped rather than shown as errors.
  const vesselList = vessels.state === 'ready' ? vessels.vessels : []
  const shownVessels = vesselList.filter(v => pane.vessels.includes(v.vesselId))
  const unusedVessels = vesselList.filter(v => !pane.vessels.includes(v.vesselId))
  const sceneVessels: SceneVessel[] = shownVessels.map(v => ({
    vesselId: v.vesselId,
    name: v.displayName || v.vesselId,
  }))
  // Only follow a vessel that's actually shown here.
  const followVesselId = shownVessels.some(v => v.vesselId === pane.followVesselId) ? pane.followVesselId : null
  const setFollow = (vesselId: string | null) => onChange({ ...pane, followVesselId: vesselId })
  const replaceVessel = (oldId: string, newId: string) =>
    onChange({
      ...pane,
      vessels: pane.vessels.map(id => (id === oldId ? newId : id)),
      // Swapping the followed vessel for another keeps following the new one.
      followVesselId: pane.followVesselId === oldId ? newId : pane.followVesselId,
    })
  const removeVessel = (vesselId: string) =>
    onChange({
      ...pane,
      vessels: pane.vessels.filter(id => id !== vesselId),
      followVesselId: pane.followVesselId === vesselId ? null : pane.followVesselId,
    })
  const addVessel = () => unusedVessels[0] && onChange({ ...pane, vessels: [...pane.vessels, unusedVessels[0].vesselId] })

  return (
    <section className="scene-pane">
      <header className="scene-pane-header">
        {datasets.state === 'loading' && <span>Datasets: loading…</span>}
        {datasets.state === 'error' && <span>Datasets: {datasets.message}</span>}
        {datasets.state === 'ready' && available.length === 0 && <span>Datasets: none available</span>}
        {resolved.map(({ index, source, dataset }) => (
          <div className="scene-pane-source" key={dataset.datasetId}>
            {/* Own dataset plus the ones not yet in this pane. */}
            <DatasetPicker
              options={available.filter(d => d.datasetId === dataset.datasetId || !usedIds.has(d.datasetId))}
              selectedId={dataset.datasetId}
              onSelect={id => updateSource(index, { datasetId: id })}
            />
            <label>
              <input type="checkbox" checked={source.live} onChange={e => updateSource(index, { live: e.target.checked })} />{' '}
              live
            </label>
            <button onClick={() => removeSource(index)} title="Remove dataset from this scene">
              −
            </button>
          </div>
        ))}
        {datasets.state === 'ready' && (
          <button onClick={addSource} disabled={unused.length === 0} title="Add a dataset to this scene">
            + dataset
          </button>
        )}
        {vessels.state === 'loading' && <span>Vessels: loading…</span>}
        {vessels.state === 'error' && <span>Vessels: {vessels.message}</span>}
        {vessels.state === 'ready' && vesselList.length === 0 && <span>Vessels: none available</span>}
        {shownVessels.map(vessel => (
          <div className="scene-pane-source" key={vessel.vesselId}>
            {/* Own vessel plus the ones not yet in this pane. */}
            <select value={vessel.vesselId} onChange={e => replaceVessel(vessel.vesselId, e.target.value)}>
              {[vessel, ...unusedVessels].map(v => (
                <option key={v.vesselId} value={v.vesselId}>
                  {v.displayName || v.vesselId}
                </option>
              ))}
            </select>
            <label title="Camera softly follows this vessel; after you pan away it glides back">
              <input
                type="checkbox"
                checked={followVesselId === vessel.vesselId}
                onChange={e => setFollow(e.target.checked ? vessel.vesselId : null)}
              />{' '}
              follow
            </label>
            <button onClick={() => removeVessel(vessel.vesselId)} title="Remove vessel from this scene">
              −
            </button>
          </div>
        ))}
        {vessels.state === 'ready' && (
          <button
            onClick={addVessel}
            disabled={unusedVessels.length === 0}
            title="Add a vessel to this scene"
          >
            + vessel
          </button>
        )}
        {onClose && (
          <button className="scene-pane-close" onClick={onClose} title="Close scene">
            ✕
          </button>
        )}
      </header>
      <div className="scene-pane-body">
        <Scene
          sources={sceneSources}
          vessels={sceneVessels}
          colorVersion={colorVersion}
          followVesselId={followVesselId}
        />
      </div>
    </section>
  )
}

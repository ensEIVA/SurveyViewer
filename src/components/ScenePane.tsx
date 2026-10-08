import type { DatasetDescriptor } from '../gen/nexus/v1/nexus_service_pb'
import type { Datasets } from '../hooks/useDatasets'
import { DatasetPicker } from './DatasetPicker'
import { Scene, type SceneSource } from './Scene'
import './ScenePane.css'

export interface SourceConfig {
  // Null until chosen: falls back to the first dataset not yet in the pane.
  datasetId: string | null
  live: boolean
}

export interface PaneConfig {
  id: string
  sources: SourceConfig[]
}

interface Props {
  pane: PaneConfig
  datasets: Datasets
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

// One scene plus its own controls: which datasets it draws, and for each,
// whether to stream its live points. Nothing here is shared with other panes.
export function ScenePane({ pane, datasets, colorVersion, onChange, onClose }: Props) {
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
        {onClose && (
          <button className="scene-pane-close" onClick={onClose} title="Close scene">
            ✕
          </button>
        )}
      </header>
      <div className="scene-pane-body">
        <Scene sources={sceneSources} colorVersion={colorVersion} />
      </div>
    </section>
  )
}

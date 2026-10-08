import type { Datasets } from '../hooks/useDatasets'
import './DatasetPicker.css'

interface Props {
  datasets: Datasets
  selectedId: string | null
  onSelect: (datasetId: string) => void
}

export function DatasetPicker({ datasets, selectedId, onSelect }: Props) {
  // Always render the box, so a missing picker is never a mystery.
  if (datasets.state === 'loading') return <div className="dataset-picker">Datasets: loading…</div>
  if (datasets.state === 'error') return <div className="dataset-picker">Datasets: {datasets.message}</div>
  if (datasets.datasets.length === 0) return <div className="dataset-picker">Datasets: none available</div>

  return (
    <label className="dataset-picker">
      Dataset{' '}
      <select value={selectedId ?? ''} onChange={e => onSelect(e.target.value)}>
        {datasets.datasets.map(d => (
          <option key={d.datasetId} value={d.datasetId}>
            {d.displayName || d.datasetId}
          </option>
        ))}
      </select>
    </label>
  )
}

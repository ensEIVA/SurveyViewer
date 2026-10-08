import type { DatasetDescriptor } from '../gen/nexus/v1/nexus_service_pb'

interface Props {
  options: DatasetDescriptor[]
  selectedId: string
  onSelect: (datasetId: string) => void
}

export function DatasetPicker({ options, selectedId, onSelect }: Props) {
  return (
    <select value={selectedId} onChange={e => onSelect(e.target.value)}>
      {options.map(d => (
        <option key={d.datasetId} value={d.datasetId}>
          {d.displayName || d.datasetId}
        </option>
      ))}
    </select>
  )
}

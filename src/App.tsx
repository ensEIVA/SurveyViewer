import { useState } from 'react'
import { DatasetPicker } from './components/DatasetPicker'
import { Scene } from './components/Scene'
import { useDatasets } from './hooks/useDatasets'

const STORAGE_KEY = 'surveyviewer.datasetId'

// localStorage can throw (private mode, blocked storage); the choice is only
// a convenience, so losing it is fine.
function loadStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Not remembered across reloads; nothing else depends on it.
  }
}

function App() {
  const datasets = useDatasets()
  const [chosenId, setChosenId] = useState<string | null>(loadStoredId)

  // The chosen dataset if Nexus still offers it, else the first one — a
  // remembered id can go stale when datasets come and go.
  const available = datasets.state === 'ready' ? datasets.datasets : []
  const selectedId = available.some(d => d.datasetId === chosenId) ? chosenId : (available[0]?.datasetId ?? null)

  const select = (id: string) => {
    setChosenId(id)
    storeId(id)
  }

  return (
    <>
      {/* key: a new dataset gets a fresh Scene — see Scene's doc comment. */}
      {selectedId && <Scene key={selectedId} datasetId={selectedId} />}
      <DatasetPicker datasets={datasets} selectedId={selectedId} onSelect={select} />
    </>
  )
}

export default App

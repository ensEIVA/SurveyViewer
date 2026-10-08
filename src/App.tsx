import { useState } from 'react'
import { ColorControls } from './components/ColorControls'
import { ScenePane, type PaneConfig } from './components/ScenePane'
import { useColorModes } from './hooks/useColorModes'
import { useDatasets } from './hooks/useDatasets'
import './App.css'

const STORAGE_KEY = 'surveyviewer.panes'

// Not crypto.randomUUID: that only exists in secure contexts, and the viewer
// may be opened over plain http on a LAN address.
const newPaneId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const newPane = (): PaneConfig => ({ id: newPaneId(), sources: [{ datasetId: null, live: true }] })

// Panes stored before scenes could hold several datasets had one dataset
// directly on the pane.
type StoredPane = PaneConfig | { id: string; datasetId: string | null; live: boolean }
const upgradePane = (p: StoredPane): PaneConfig =>
  'sources' in p ? p : { id: p.id, sources: [{ datasetId: p.datasetId, live: p.live }] }

// localStorage can throw (private mode, blocked storage) or hold something
// stale; the layout is only a convenience, so fall back to one fresh pane.
function loadPanes(): PaneConfig[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (Array.isArray(stored) && stored.length > 0) return (stored as StoredPane[]).map(upgradePane)
  } catch {
    // Fall through to the default.
  }
  return [newPane()]
}

function storePanes(panes: PaneConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panes))
  } catch {
    // Not remembered across reloads; nothing else depends on it.
  }
}

function App() {
  const datasets = useDatasets()
  // Colour mode is shared server-side by every frontend, so it's chosen once
  // here, not per pane.
  const colorModes = useColorModes()
  // Bumped after each accepted colour change: every pane reloads its tiles,
  // which Nexus colours, instead of waiting for its next poll.
  const [colorVersion, setColorVersion] = useState(0)
  const [panes, setPanes] = useState<PaneConfig[]>(loadPanes)

  const updatePanes = (next: PaneConfig[]) => {
    setPanes(next)
    storePanes(next)
  }

  return (
    <div className="app">
      <header className="app-toolbar">
        <button onClick={() => updatePanes([...panes, newPane()])}>+ scene</button>
        <ColorControls modes={colorModes} onChanged={() => setColorVersion(v => v + 1)} />
      </header>
      <main className="scene-grid">
        {panes.map(pane => (
          <ScenePane
            key={pane.id}
            pane={pane}
            datasets={datasets}
            colorVersion={colorVersion}
            onChange={changed => updatePanes(panes.map(p => (p.id === changed.id ? changed : p)))}
            onClose={panes.length > 1 ? () => updatePanes(panes.filter(p => p.id !== pane.id)) : undefined}
          />
        ))}
      </main>
    </div>
  )
}

export default App

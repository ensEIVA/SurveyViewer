import type { MapViewState } from '@deck.gl/core'
import './CameraOverlay.css'

// Where the camera is looking: enough to read off, or reproduce, a view.
export function CameraOverlay({ viewState }: { viewState: MapViewState }) {
  const { latitude, longitude, zoom, pitch = 0, bearing = 0 } = viewState
  return (
    <div className="camera-overlay">
      <div>
        centre {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </div>
      <div>
        zoom {zoom.toFixed(1)} pitch {pitch.toFixed(0)}° bearing {bearing.toFixed(0)}°
      </div>
    </div>
  )
}

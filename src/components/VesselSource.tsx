import { memo, useEffect, useMemo, useState } from 'react'
import { useVesselPosition } from '../hooks/useVesselPosition'
import { makeVesselLayers } from '../layers/vesselLayer'
import type { SourceReport } from './DatasetSource'

// A position older than this is shown as stale: the stream is quiet (e.g.
// its source is down), so the vessel may well be elsewhere by now.
const STALE_AFTER_MS = 10_000
// How often staleness is re-checked when no new position arrives.
const STALE_CHECK_MS = 1_000

interface Props {
  vesselId: string
  // Must be stable (useCallback): see DatasetSource.
  onReport: (key: string, report: SourceReport | null) => void
}

const reportKey = (vesselId: string) => `vessel:${vesselId}`

// One vessel in a scene: its position stream, drawn as layers reported up
// to the Scene — the vessel counterpart of DatasetSource. Mounted with
// key={vesselId}.
export const VesselSource = memo(function VesselSource({ vesselId, onReport }: Props) {
  const { position, connected } = useVesselPosition(vesselId)
  // Ticks so a position goes stale even when no new one arrives to cause a
  // re-render.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), STALE_CHECK_MS)
    return () => clearInterval(id)
  }, [])

  const ageMs = position?.measuredAt ? now - position.measuredAt.getTime() : null
  const stale = ageMs !== null && ageMs > STALE_AFTER_MS

  const layers = useMemo(() => (position ? makeVesselLayers(vesselId, position, stale) : []), [vesselId, position, stale])

  let status = connected ? 'waiting for a position…' : 'connecting…'
  if (position) {
    const age = ageMs === null ? '' : ` (${Math.max(0, Math.round(ageMs / 1000))} s ago${stale ? ', stale' : ''})`
    status =
      `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)} ` +
      `hdg ${position.heading.toFixed(0)}° roll ${position.roll.toFixed(1)}° pitch ${position.pitch.toFixed(1)}°${age}`
    if (!connected) status += ' | reconnecting…'
  }

  useEffect(() => {
    const where = position ? { longitude: position.longitude, latitude: position.latitude } : undefined
    onReport(reportKey(vesselId), { layers, status, livePointCount: 0, position: where })
  }, [vesselId, layers, status, position, onReport])
  useEffect(() => () => onReport(reportKey(vesselId), null), [vesselId, onReport])

  return null
})

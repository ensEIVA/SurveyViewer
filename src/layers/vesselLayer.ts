import { COORDINATE_SYSTEM } from '@deck.gl/core'
import { PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { VesselPosition } from '../hooks/useVesselPosition'

// A generic hull outline, metres, bow pointing north (+Y) — real dimensions
// per vessel aren't in the contract yet.
const LENGTH_M = 60
const BEAM_M = 14
const HULL: [number, number][] = [
  [0, LENGTH_M / 2],
  [BEAM_M / 2, LENGTH_M / 4],
  [BEAM_M / 2, -LENGTH_M / 2],
  [-BEAM_M / 2, -LENGTH_M / 2],
  [-BEAM_M / 2, LENGTH_M / 4],
]

const FRESH_COLOR: [number, number, number] = [255, 140, 0]
const STALE_COLOR: [number, number, number] = [150, 150, 150]

// Turns the hull to the vessel's heading: clockwise from north, as a compass
// reads it (so a heading of 90° puts the bow east).
function rotateToHeading(headingDegrees: number): [number, number][] {
  const h = (headingDegrees * Math.PI) / 180
  const cos = Math.cos(h)
  const sin = Math.sin(h)
  return HULL.map(([x, y]) => [x * cos + y * sin, -x * sin + y * cos])
}

// The vessel as a flat hull outline turned to its heading, plus a dot that
// keeps it visible when zoomed out too far for a 60 m outline to show. Roll
// and pitch aren't drawn — a flat outline can't show them; a 3D model could.
// `stale`: the position is old enough that the vessel may well be elsewhere.
export function makeVesselLayers(vesselId: string, position: VesselPosition, stale: boolean) {
  const color = stale ? STALE_COLOR : FRESH_COLOR
  const origin: [number, number, number] = [position.longitude, position.latitude, position.height]
  return [
    new PolygonLayer({
      id: `vessel-hull-${vesselId}`,
      data: [{ polygon: rotateToHeading(position.heading) }],
      getPolygon: d => d.polygon,
      coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
      coordinateOrigin: origin,
      getFillColor: [...color, 200],
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 1,
    }),
    new ScatterplotLayer({
      id: `vessel-dot-${vesselId}`,
      data: [origin],
      getPosition: d => d,
      getFillColor: color,
      getLineColor: [255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 1,
      radiusMinPixels: 5,
      radiusMaxPixels: 5,
    }),
  ]
}

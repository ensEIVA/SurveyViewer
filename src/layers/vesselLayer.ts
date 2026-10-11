import { ScatterplotLayer } from '@deck.gl/layers'
import { SimpleMeshLayer } from '@deck.gl/mesh-layers'
import type { VesselPosition } from '../hooks/useVesselPosition'
import { VESSEL_MESH } from './vesselMesh'

const FRESH_COLOR: [number, number, number] = [255, 140, 0]
const STALE_COLOR: [number, number, number] = [150, 150, 150]

// deck.gl's mesh orientation is [pitch, yaw, roll] in degrees, applied as
// Rz(yaw)·Ry(pitch)·Rx(roll) about east/north/up, with the mesh's bow on +X
// and port on +Y. The contract uses the maritime convention instead, so:
// - heading is clockwise from north, deck's yaw counter-clockwise from east;
// - pitch is positive bow up, deck's positive pitch tips +X (the bow) down;
// - roll is positive starboard down, which is deck's positive roll already.
function toDeckOrientation({ heading, pitch, roll }: VesselPosition): [number, number, number] {
  return [-pitch, 90 - heading, roll]
}

// The vessel as a 3D hull turned and tilted by its heading, roll and pitch,
// plus a dot that keeps it visible when zoomed out too far for a 60 m hull to
// show. `stale`: the position is old enough that the vessel may well be
// elsewhere.
export function makeVesselLayers(vesselId: string, position: VesselPosition, stale: boolean) {
  const color = stale ? STALE_COLOR : FRESH_COLOR
  const where: [number, number, number] = [position.longitude, position.latitude, position.height]
  return [
    new SimpleMeshLayer({
      id: `vessel-hull-${vesselId}`,
      data: [where],
      mesh: VESSEL_MESH,
      getPosition: d => d,
      getOrientation: toDeckOrientation(position),
      getColor: color,
      // Mesh units are metres when positions are longitude/latitude.
      sizeScale: 1,
    }),
    new ScatterplotLayer({
      id: `vessel-dot-${vesselId}`,
      data: [where],
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

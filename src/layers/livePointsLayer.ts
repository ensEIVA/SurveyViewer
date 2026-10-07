import { COORDINATE_SYSTEM } from '@deck.gl/core'
import { PointCloudLayer } from '@deck.gl/layers'
import type { DecodedPointSet, LivePoints } from '../lib/livePoints'

// Bigger than the tileset's pointSize=2, to visually flag "not yet in the tree".
const POINT_SIZE = 4

function makePointSetLayer(id: string, set: DecodedPointSet, { coordinateOrigin, modelMatrix }: LivePoints) {
  return new PointCloudLayer({
    id,
    data: {
      length: set.count,
      attributes: {
        getPosition: { value: set.positions, size: 3 },
        getColor: { value: set.colors, size: 3 },
      },
    },
    coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
    coordinateOrigin,
    modelMatrix,
    pointSize: POINT_SIZE,
  })
}

// The live points and the clock Nexus draws above them, as two layers in the
// same frame.
export function makeLivePointsLayers(live: LivePoints) {
  return [makePointSetLayer('live-points', live.points, live), makePointSetLayer('live-clock', live.clock, live)]
}

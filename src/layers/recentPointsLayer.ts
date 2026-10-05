import { COORDINATE_SYSTEM } from '@deck.gl/core'
import { PointCloudLayer } from '@deck.gl/layers'
import type { RecentPoints } from '../lib/recentPoints'

// Bigger than the tileset's pointSize=2, to visually flag "not yet in the tree".
const POINT_SIZE = 4

// Recent points are meter offsets in the same local frame as the tileset,
// whose GeoReference the backend currently anchors at lon/lat 0,0. Must
// match it, or the overlay drifts away from the tiles.
const ORIGIN: [number, number, number] = [0, 0, 0]

export function makeRecentPointsLayer({ count, positions, colors }: RecentPoints) {
  return new PointCloudLayer({
    id: 'recent-points',
    data: {
      length: count,
      attributes: {
        getPosition: { value: positions, size: 3 },
        getColor: { value: colors, size: 3 },
      },
    },
    coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
    coordinateOrigin: ORIGIN,
    pointSize: POINT_SIZE,
  })
}

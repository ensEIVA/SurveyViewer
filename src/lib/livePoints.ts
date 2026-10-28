import type { ILivePointsSnapshot } from '../gen/nexus/v1/nexus_topics.fletcher'

export interface DecodedPointSet {
  count: number
  // count x 3: X, Y, Z in metres, relative to LivePoints' origin.
  positions: Float32Array
  // count x 3: R, G, B.
  colors: Uint8Array
}

export interface LivePoints {
  points: DecodedPointSet
  clock: DecodedPointSet
  // [longitude, latitude, height] of the dataset's GeoReference — deck.gl's
  // METER_OFFSETS anchor, the same frame the tilesets use.
  coordinateOrigin: [number, number, number]
  // Translation by the snapshot's origin: positions are float32 offsets from
  // it (keeps them small enough for float32 to stay precise).
  modelMatrix: Matrix4
}

// Column-major 4x4, as deck.gl's modelMatrix expects.
export type Matrix4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

function decodePointSet(count: number, positions: Uint8Array, colors: Uint8Array, name: string): DecodedPointSet {
  if (positions.byteLength !== count * 3 * 4) {
    throw new Error(`${name}: ${positions.byteLength} position bytes for ${count} points, expected ${count * 12}`)
  }
  if (colors.byteLength !== count * 3) {
    throw new Error(`${name}: ${colors.byteLength} color bytes for ${count} points, expected ${count * 3}`)
  }
  // A Float32Array needs a 4-byte-aligned offset. The Fletcher decoder
  // copies each bytes field into a buffer of its own, so it normally is,
  // and the points are used in place; otherwise they're copied first. The
  // data is little-endian, which every browser platform is natively.
  const aligned = positions.byteOffset % 4 === 0 ? positions : positions.slice()
  return {
    count,
    positions: new Float32Array(aligned.buffer, aligned.byteOffset, count * 3),
    colors,
  }
}

export function decodeLivePoints(row: ILivePointsSnapshot): LivePoints {
  return {
    points: decodePointSet(row.point_count, row.point_positions, row.point_colors, 'points'),
    clock: decodePointSet(row.clock_point_count, row.clock_positions, row.clock_colors, 'clock'),
    coordinateOrigin: [row.geo_longitude_degrees, row.geo_latitude_degrees, row.geo_height_meters],
    modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, row.origin_x, row.origin_y, row.origin_z, 1],
  }
}

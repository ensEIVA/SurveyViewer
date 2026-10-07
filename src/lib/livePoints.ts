import type { GetLivePointsResponse, PointSet } from '../gen/nexus/v1/nexus_service_pb'

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
  // Translation by the response's origin: positions are float32 offsets from
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

const EMPTY: DecodedPointSet = { count: 0, positions: new Float32Array(0), colors: new Uint8Array(0) }

function decodePointSet(set: PointSet | undefined, name: string): DecodedPointSet {
  if (!set) return EMPTY
  const { count, positions, colors } = set
  if (positions.byteLength !== count * 3 * 4) {
    throw new Error(`${name}: ${positions.byteLength} position bytes for ${count} points, expected ${count * 12}`)
  }
  if (colors.byteLength !== count * 3) {
    throw new Error(`${name}: ${colors.byteLength} color bytes for ${count} points, expected ${count * 3}`)
  }
  return {
    count,
    // slice() first: protobuf bytes are a view into the whole response
    // buffer at whatever offset the field happened to land, and a
    // Float32Array needs a 4-byte-aligned buffer of its own. The data is
    // little-endian, which every browser platform is natively.
    positions: new Float32Array(positions.slice().buffer),
    colors,
  }
}

export function decodeLivePoints(res: GetLivePointsResponse): LivePoints {
  const geo = res.geoReference
  if (!geo) throw new Error('GetLivePoints response has no geo_reference')
  const origin = res.origin ?? { x: 0, y: 0, z: 0 }
  return {
    points: decodePointSet(res.points, 'points'),
    clock: decodePointSet(res.clock, 'clock'),
    coordinateOrigin: [geo.longitudeDegrees, geo.latitudeDegrees, geo.heightMeters],
    modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, origin.x, origin.y, origin.z, 1],
  }
}

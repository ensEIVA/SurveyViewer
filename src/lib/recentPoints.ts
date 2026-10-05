// Wire format of /recent-points.bin: a flat array of points, no header —
// count is byteLength / POINT_BYTES. Each point is 3x little-endian
// float64 (x, y, z, meters) followed by 3x uint8 (r, g, b).
const POINT_BYTES = 3 * 8 + 3

export interface RecentPoints {
  count: number
  // Float32 (not 64) because that's what deck.gl uploads to the GPU
  // anyway; positions are meter offsets from a nearby origin, so float32
  // precision is plenty.
  positions: Float32Array
  colors: Uint8Array
}

export function decodeRecentPoints(buffer: ArrayBuffer): RecentPoints {
  if (buffer.byteLength % POINT_BYTES !== 0) {
    throw new Error(`recent points payload is ${buffer.byteLength} bytes, not a multiple of ${POINT_BYTES}`)
  }
  const count = buffer.byteLength / POINT_BYTES
  const view = new DataView(buffer)
  const positions = new Float32Array(count * 3)
  const colors = new Uint8Array(count * 3)
  let o = 0
  for (let i = 0; i < count; i++) {
    positions[i * 3] = view.getFloat64(o, true)
    positions[i * 3 + 1] = view.getFloat64(o + 8, true)
    positions[i * 3 + 2] = view.getFloat64(o + 16, true)
    colors[i * 3] = view.getUint8(o + 24)
    colors[i * 3 + 1] = view.getUint8(o + 25)
    colors[i * 3 + 2] = view.getUint8(o + 26)
    o += POINT_BYTES
  }
  return { count, positions, colors }
}

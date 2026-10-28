import { describe, expect, it } from 'vitest'
import type { ILivePointsSnapshot } from '../gen/nexus/v1/nexus_topics.fletcher'
import { decodeLivePoints } from './livePoints'

const bytes = (floats: number[]) => new Uint8Array(new Float32Array(floats).buffer)

const snapshot = (overrides: Partial<ILivePointsSnapshot> = {}): ILivePointsSnapshot => ({
  dataset_id: 'survey-a',
  taken_at: 0n,
  geo_latitude_degrees: 56.1,
  geo_longitude_degrees: 10.2,
  geo_height_meters: 40,
  origin_x: 100,
  origin_y: 200,
  origin_z: -5,
  point_count: 2,
  point_positions: bytes([1, 2, 3, 4, 5, 6]),
  point_colors: new Uint8Array([255, 0, 0, 0, 255, 0]),
  clock_point_count: 0,
  clock_positions: new Uint8Array(0),
  clock_colors: new Uint8Array(0),
  ...overrides,
})

describe('decodeLivePoints', () => {
  it('anchors on the georeference and translates by the origin', () => {
    const live = decodeLivePoints(snapshot())
    expect(live.coordinateOrigin).toEqual([10.2, 56.1, 40])
    expect(live.modelMatrix.slice(12)).toEqual([100, 200, -5, 1])
    expect(Array.from(live.points.positions)).toEqual([1, 2, 3, 4, 5, 6])
    expect(live.clock.count).toBe(0)
  })

  it('reads positions in place when aligned, and copies them when not', () => {
    const aligned = bytes([1, 2, 3])
    expect(decodeLivePoints(snapshot({ point_count: 1, point_positions: aligned, point_colors: new Uint8Array(3) })).points.positions.buffer).toBe(aligned.buffer)

    const shifted = new Uint8Array(13)
    shifted.set(bytes([7, 8, 9]), 1)
    const positions = shifted.subarray(1)
    const live = decodeLivePoints(snapshot({ point_count: 1, point_positions: positions, point_colors: new Uint8Array(3) }))
    expect(Array.from(live.points.positions)).toEqual([7, 8, 9])
  })

  it('rejects byte lengths that disagree with the count', () => {
    expect(() => decodeLivePoints(snapshot({ point_count: 3 }))).toThrow(/points: 24 position bytes for 3 points/)
  })
})

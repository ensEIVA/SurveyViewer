// A generic vessel built from a few flat-shaded polygons — no model file
// needed. Metres, in deck.gl's SimpleMeshLayer model space: bow along +X,
// port along +Y, up along +Z, waterline at Z = 0. Real dimensions per vessel
// aren't in the contract yet.

type Vec3 = [number, number, number]

const LENGTH_M = 60
const BEAM_M = 14
const FREEBOARD_M = 3 // deck height above the waterline
const DRAUGHT_M = 3 // keel depth below it

const HALF_L = LENGTH_M / 2
const HALF_B = BEAM_M / 2

// Deck outline (at freeboard) and keel outline (at draught, narrower so the
// sides slope in), both bow first and going round the same way.
const DECK: Vec3[] = [
  [HALF_L, 0, FREEBOARD_M],
  [HALF_L / 2, HALF_B, FREEBOARD_M],
  [-HALF_L, HALF_B, FREEBOARD_M],
  [-HALF_L, -HALF_B, FREEBOARD_M],
  [HALF_L / 2, -HALF_B, FREEBOARD_M],
]
const KEEL: Vec3[] = DECK.map(([x, y]) => [x * 0.9, y * 0.55, -DRAUGHT_M])

// Bridge/superstructure: a box towards the stern.
const BOX = { x0: -HALF_L * 0.7, x1: -HALF_L * 0.1, y: HALF_B * 0.7, z0: FREEBOARD_M, z1: FREEBOARD_M + 7 }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = (v: Vec3): Vec3 => {
  const len = Math.hypot(...v) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

// Every face is convex, so it can be fanned into triangles. Each face gets
// its own vertices and one normal (flat shading), pointed away from `centre`
// so faces light correctly whichever way round they were listed.
function buildMesh(faces: { polygon: Vec3[]; centre: Vec3 }[]) {
  const positions: number[] = []
  const normals: number[] = []
  for (const { polygon, centre } of faces) {
    let normal = normalize(cross(sub(polygon[1], polygon[0]), sub(polygon[2], polygon[0])))
    const faceCentre = polygon.reduce<Vec3>((c, p) => [c[0] + p[0], c[1] + p[1], c[2] + p[2]], [0, 0, 0])
    const outward = sub(faceCentre.map(v => v / polygon.length) as Vec3, centre)
    if (dot(normal, outward) < 0) normal = [-normal[0], -normal[1], -normal[2]]
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const p of [polygon[0], polygon[i], polygon[i + 1]]) {
        positions.push(...p)
        normals.push(...normal)
      }
    }
  }
  return {
    positions: { size: 3, value: new Float32Array(positions) },
    normals: { size: 3, value: new Float32Array(normals) },
  }
}

function boxFaces(): Vec3[][] {
  const { x0, x1, y, z0, z1 } = BOX
  const c = (x: number, yy: number, z: number): Vec3 => [x, yy, z]
  return [
    [c(x0, -y, z1), c(x1, -y, z1), c(x1, y, z1), c(x0, y, z1)], // roof
    [c(x1, -y, z0), c(x1, y, z0), c(x1, y, z1), c(x1, -y, z1)], // front
    [c(x0, -y, z0), c(x0, -y, z1), c(x0, y, z1), c(x0, y, z0)], // back
    [c(x0, y, z0), c(x0, y, z1), c(x1, y, z1), c(x1, y, z0)], // port
    [c(x0, -y, z0), c(x1, -y, z0), c(x1, -y, z1), c(x0, -y, z1)], // starboard
  ]
}

const hullCentre: Vec3 = [0, 0, 0]
const boxCentre: Vec3 = [(BOX.x0 + BOX.x1) / 2, 0, (BOX.z0 + BOX.z1) / 2]

export const VESSEL_MESH = buildMesh([
  { polygon: DECK, centre: hullCentre },
  { polygon: [...KEEL].reverse(), centre: hullCentre },
  // Sides: one quad per deck edge, down to the matching keel edge.
  ...DECK.map((_, i) => {
    const j = (i + 1) % DECK.length
    return { polygon: [DECK[i], DECK[j], KEEL[j], KEEL[i]], centre: hullCentre }
  }),
  ...boxFaces().map(polygon => ({ polygon, centre: boxCentre })),
])

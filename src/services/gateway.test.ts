import { encodePositional, serializeEnvelope } from '@eiva/fletcher-gateway-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VesselPosition, type IVesselPosition } from '../gen/nexus/v1/nexus_topics.fletcher'
import { GatewayConnection } from './gateway'
import { VESSEL_POSITION_TOPIC } from './topics'

// Stands in for the browser's WebSocket, which FletcherClient opens itself;
// the test methods below play the gateway's side.
class FakeSocket {
  static OPEN = 1
  static all: FakeSocket[] = []
  url: string
  binaryType = 'blob'
  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  sent: { action: string; topic?: string; subId?: string }[] = []
  closed = false

  constructor(url: string) {
    this.url = url
    FakeSocket.all.push(this)
  }
  send(data: string) {
    const message = JSON.parse(data)
    this.sent.push(message)
    // Answer the heartbeat as the gateway would.
    if (message.action === 'list_topics') queueMicrotask(() => this.reply({ type: 'topics_list', topics: [] }))
  }
  close() {
    this.closed = true
    this.drop()
  }

  accept() {
    this.readyState = 1
    this.onopen?.()
  }
  refuse() {
    this.onerror?.()
    this.drop()
  }
  drop() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.()
  }
  reply(json: object) {
    this.onmessage?.({ data: JSON.stringify(json) })
  }
  deliver(subId: bigint, row: IVesselPosition) {
    const envelope = serializeEnvelope({ row: encodePositional(VesselPosition, { ...row }), attachments: new Map() })
    const frame = new Uint8Array(8 + envelope.byteLength)
    new DataView(frame.buffer).setBigUint64(0, subId, true)
    frame.set(envelope, 8)
    this.onmessage?.({ data: frame.buffer })
  }
  subscribes(topic: string) {
    return this.sent.filter(m => m.action === 'subscribe' && m.topic === topic).length
  }
}

const TOPIC = VESSEL_POSITION_TOPIC

const position = (vessel_id: string): IVesselPosition => ({
  vessel_id,
  pos_longitude: 10.2,
  pos_latitude: 56.1,
  pos_height: 42,
  rot_roll: 1,
  rot_pitch: 2,
  rot_yaw: 270,
  timestamp: 1_700_000_000_000_000_000n,
})

let gateway: GatewayConnection
const sockets = () => FakeSocket.all
const latest = () => FakeSocket.all[FakeSocket.all.length - 1]
// Lets FletcherClient's promises settle.
const settle = () => vi.advanceTimersByTimeAsync(0)

// Opens the connection and confirms TOPIC's subscription as `subId`.
async function connect(subId: string) {
  latest().accept()
  await settle()
  latest().reply({ type: 'subscribed', subId, topic: TOPIC })
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  FakeSocket.all = []
  gateway = new GatewayConnection('ws://test')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GatewayConnection', () => {
  it('subscribes each topic once and hands every decoded row to all its listeners', async () => {
    const a = vi.fn()
    const b = vi.fn()
    gateway.subscribe(TOPIC, VesselPosition, a, () => {})
    gateway.subscribe(TOPIC, VesselPosition, b, () => {})
    await connect('7')
    expect(sockets()).toHaveLength(1)
    expect(latest().subscribes(TOPIC)).toBe(1)

    latest().deliver(7n, position('vessel-a'))
    expect(a).toHaveBeenCalledWith(position('vessel-a'))
    expect(b).toHaveBeenCalledWith(position('vessel-a'))
  })

  it('reports connected once the subscription is confirmed, and to a late listener straight away', async () => {
    const early = vi.fn()
    gateway.subscribe(TOPIC, VesselPosition, () => {}, early)
    latest().accept()
    await settle()
    expect(early).not.toHaveBeenCalled()
    latest().reply({ type: 'subscribed', subId: '7', topic: TOPIC })
    await settle()
    expect(early).toHaveBeenLastCalledWith(true)

    const late = vi.fn()
    gateway.subscribe(TOPIC, VesselPosition, () => {}, late)
    expect(late).toHaveBeenLastCalledWith(true)
  })

  it('unsubscribes the topic with its last listener, and closes the socket with the last topic', async () => {
    const offA = gateway.subscribe(TOPIC, VesselPosition, () => {}, () => {})
    const offB = gateway.subscribe(TOPIC, VesselPosition, () => {}, () => {})
    await connect('7')

    offA()
    expect(latest().sent).not.toContainEqual({ action: 'unsubscribe', subId: '7' })
    offB()
    expect(latest().sent).toContainEqual({ action: 'unsubscribe', subId: '7' })
    expect(latest().closed).toBe(true)
  })

  it('finds a drop by the heartbeat, reopens with backoff and subscribes again', async () => {
    const onRow = vi.fn()
    const onConnected = vi.fn()
    gateway.subscribe(TOPIC, VesselPosition, onRow, onConnected)
    await connect('7')

    latest().drop()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(onConnected).toHaveBeenLastCalledWith(false)
    await vi.advanceTimersByTimeAsync(999)
    expect(sockets()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sockets()).toHaveLength(2)

    // Still down: the next wait is twice as long.
    latest().refuse()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(sockets()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(sockets()).toHaveLength(3)

    await connect('9')
    expect(latest().subscribes(TOPIC)).toBe(1)
    expect(onConnected).toHaveBeenLastCalledWith(true)
    latest().deliver(9n, position('vessel-a'))
    expect(onRow).toHaveBeenCalledTimes(1)
  })

  it('keeps a healthy connection open', async () => {
    gateway.subscribe(TOPIC, VesselPosition, () => {}, () => {})
    await connect('7')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sockets()).toHaveLength(1)
    expect(latest().closed).toBe(false)
  })

  it('drops the extra subscription when a listener leaves and returns before the reply', async () => {
    // Another topic keeps the socket open in between.
    gateway.subscribe('other', VesselPosition, () => {}, () => {})
    latest().accept()
    await settle()
    const off = gateway.subscribe(TOPIC, VesselPosition, () => {}, () => {})
    off()
    const onRow = vi.fn()
    gateway.subscribe(TOPIC, VesselPosition, onRow, () => {})
    expect(sockets()).toHaveLength(1)
    expect(latest().subscribes(TOPIC)).toBe(2)

    latest().reply({ type: 'subscribed', subId: '6', topic: 'other' })
    latest().reply({ type: 'subscribed', subId: '7', topic: TOPIC })
    latest().reply({ type: 'subscribed', subId: '8', topic: TOPIC })
    await settle()

    expect(latest().sent).toContainEqual({ action: 'unsubscribe', subId: '7' })
    latest().deliver(8n, position('vessel-a'))
    expect(onRow).toHaveBeenCalledTimes(1)
  })

  it('stops reconnecting once nobody is subscribed', async () => {
    const off = gateway.subscribe(TOPIC, VesselPosition, () => {}, () => {})
    latest().refuse()
    await settle()
    off()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sockets()).toHaveLength(1)
  })
})

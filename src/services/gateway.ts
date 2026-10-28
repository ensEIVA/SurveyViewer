import { FletcherClient, type TypedSchema } from '@eiva/fletcher-gateway-client'
import { GATEWAY_URL } from '../config'

// Reopen delays after the connection drops or fails to open: doubles each
// failed attempt, back to the start once a subscription is confirmed.
const RECONNECT_MIN_MS = 1_000
const RECONNECT_MAX_MS = 10_000

// How often the connection is checked. FletcherClient doesn't report a
// dropped socket, but any request on one fails, so a cheap request
// (listing the topics) every HEARTBEAT_MS finds a drop within that time.
const HEARTBEAT_MS = 2_000

interface Listener {
  onRow: (row: unknown) => void
  // True once the topic's subscription is confirmed, false when the
  // connection drops.
  onConnected: (connected: boolean) => void
}

interface Topic {
  schema: TypedSchema<unknown>
  listeners: Set<Listener>
  // Set once the gateway confirms the subscription; null while waiting.
  subId: bigint | null
}

// One FletcherClient connection to the gateway, shared by every subscriber.
// Each topic is subscribed once however many listeners it has, and each row
// is decoded once and handed to all of them. The connection is opened with
// the first topic and closed with the last; if it drops while topics remain
// it is reopened with backoff and every topic is subscribed again.
export class GatewayConnection {
  private url: string
  // Null while closed or waiting to reopen.
  private client: FletcherClient | null = null
  // The client has connected; subscribe now rather than once it opens.
  private ready = false
  private topics = new Map<string, Topic>()
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private delay = RECONNECT_MIN_MS

  constructor(url: string) {
    this.url = url
  }

  // Calls onRow with every row published on `topic` from now on, decoded
  // with `schema`. Returns the unsubscribe function.
  subscribe<T>(
    topic: string,
    schema: TypedSchema<T>,
    onRow: (row: T) => void,
    onConnected: (connected: boolean) => void,
  ): () => void {
    const listener: Listener = { onRow: onRow as (row: unknown) => void, onConnected }
    let entry = this.topics.get(topic)
    if (!entry) {
      entry = { schema, listeners: new Set(), subId: null }
      this.topics.set(topic, entry)
      if (this.ready) this.subscribeTopic(topic, entry)
    }
    entry.listeners.add(listener)
    if (entry.subId !== null) onConnected(true)
    if (!this.client && this.reconnectTimer === undefined) this.open()

    return () => this.unsubscribe(topic, listener)
  }

  private unsubscribe(topic: string, listener: Listener) {
    const entry = this.topics.get(topic)
    if (!entry?.listeners.delete(listener) || entry.listeners.size > 0) return
    this.topics.delete(topic)
    if (entry.subId !== null) this.client?.unsubscribe(entry.subId).catch(() => {})
    if (this.topics.size === 0) this.shutDown()
  }

  private async open() {
    const client = new FletcherClient({ url: this.url })
    this.client = client
    try {
      await client.connect()
    } catch (err) {
      if (client === this.client) this.dropped(err)
      return
    }
    // Everyone left while it was connecting.
    if (client !== this.client) return client.close()
    this.ready = true
    for (const [topic, entry] of this.topics) this.subscribeTopic(topic, entry)

    let checking = false
    this.heartbeat = setInterval(() => {
      if (checking) return
      checking = true
      client
        .listTopics()
        .catch(err => {
          if (client === this.client) this.dropped(err)
        })
        .finally(() => (checking = false))
    }, HEARTBEAT_MS)
  }

  private async subscribeTopic(topic: string, entry: Topic) {
    const client = this.client!
    let subId: bigint
    try {
      subId = await client.subscribe(topic, entry.schema, row => {
        for (const l of entry.listeners) l.onRow(row)
      })
    } catch (err) {
      // A dropped connection is found by the heartbeat; anything else
      // (the gateway refusing the topic) leaves the topic unsubscribed.
      console.warn(`[viewer] Fletcher gateway subscribe to ${topic} failed`, err)
      return
    }
    if (client !== this.client) return
    // Every listener left while the subscribe was in flight (and maybe came
    // back, which subscribed again).
    if (this.topics.get(topic) !== entry) {
      client.unsubscribe(subId).catch(() => {})
      return
    }
    entry.subId = subId
    this.delay = RECONNECT_MIN_MS
    for (const l of entry.listeners) l.onConnected(true)
  }

  private dropped(err: unknown) {
    this.closeClient()
    for (const entry of this.topics.values()) {
      entry.subId = null
      for (const l of entry.listeners) l.onConnected(false)
    }
    console.warn(`[viewer] Fletcher gateway connection lost; reopening in ${this.delay} ms`, err)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.open()
    }, this.delay)
    this.delay = Math.min(this.delay * 2, RECONNECT_MAX_MS)
  }

  private shutDown() {
    this.closeClient()
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    this.delay = RECONNECT_MIN_MS
  }

  private closeClient() {
    clearInterval(this.heartbeat)
    this.heartbeat = undefined
    this.client?.close()
    this.client = null
    this.ready = false
  }
}

export const gateway = new GatewayConnection(GATEWAY_URL)

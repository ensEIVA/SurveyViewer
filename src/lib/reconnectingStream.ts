// Reopen delays after a stream ends or fails: doubles each failed attempt,
// back to the start as soon as a message arrives.
const RECONNECT_MIN_MS = 1_000
const RECONNECT_MAX_MS = 10_000

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(id)
      resolve()
    })
  })

interface Options<T> {
  // Opens the server stream; called again for every reconnect.
  open: (signal: AbortSignal) => AsyncIterable<T>
  onMessage: (message: T) => void
  // The stream is down and waiting to reopen.
  onDisconnected: () => void
  // For the console when a stream fails, e.g. "GetLivePoints".
  label: string
  // Aborting it closes the stream and stops reconnecting.
  signal: AbortSignal
}

// Keeps a server stream open until `signal` aborts: if it ever ends or fails
// (Nexus restart, network drop) it's reopened with backoff. A stream that
// ends cleanly is reopened too — Nexus's streams are meant to run for as
// long as a frontend watches.
export async function runReconnectingStream<T>({ open, onMessage, onDisconnected, label, signal }: Options<T>) {
  let delay = RECONNECT_MIN_MS
  while (!signal.aborted) {
    try {
      for await (const message of open(signal)) {
        onMessage(message)
        delay = RECONNECT_MIN_MS
      }
    } catch (err) {
      if (signal.aborted) return
      console.warn(`[viewer] ${label} stream failed`, err)
    }
    if (signal.aborted) return
    onDisconnected()
    await sleep(delay, signal)
    delay = Math.min(delay * 2, RECONNECT_MAX_MS)
  }
}

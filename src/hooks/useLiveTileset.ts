import { useEffect, useState } from 'react'

export interface TilesetEntry {
  url: string
  label: string
}

// Two, not one: the newest tileset is still loading when it's added, so
// keeping the previous one visible underneath avoids a blank frame on
// every poll. Each extra entry costs a full tile cache, so no more.
const MAX_VISIBLE_TILESETS = 2

// The backend regenerates tileset.json on every request at the same url,
// but Tile3DLayer keys its loaded state off the exact url string — so each
// poll gets a cache-busting `t` param to force a real reload. A null url
// (not known yet) means don't poll.
export function useLiveTileset(tilesetUrl: string | null, pollMs: number): TilesetEntry[] {
  const [tilesets, setTilesets] = useState<TilesetEntry[]>([])

  useEffect(() => {
    if (!tilesetUrl) return
    const tick = () => {
      const url = new URL(tilesetUrl)
      url.searchParams.set('t', String(Date.now()))
      const entry = { url: url.toString(), label: `live @ ${new Date().toLocaleTimeString()}` }
      // Two ticks in the same millisecond (StrictMode runs this effect
      // twice in dev) would produce the same url — and thus two layers
      // with the same id, which deck.gl rejects.
      setTilesets(prev =>
        prev.at(-1)?.url === entry.url ? prev : [...prev, entry].slice(-MAX_VISIBLE_TILESETS),
      )
    }
    tick()
    const id = setInterval(tick, pollMs)
    return () => clearInterval(id)
  }, [tilesetUrl, pollMs])

  return tilesets
}

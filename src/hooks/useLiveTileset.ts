import { useCallback, useEffect, useState } from 'react'

// One of the two Tile3DLayers the double buffer alternates between. The id
// is the layer's identity; the url is what it's currently loading/showing.
export interface TilesetSlot {
  id: 'a' | 'b'
  url: string
  label: string
}

export interface LiveTileset {
  // On screen. Null only until the very first poll.
  front: TilesetSlot | null
  // Off screen, loading the next poll. Null when nothing is loading.
  back: TilesetSlot | null
  // Call once the back slot's view is fully loaded: it becomes the front,
  // and the old front is dropped, freeing its slot for the next poll.
  promoteBack: () => void
}

const otherSlot = (id: TilesetSlot['id']) => (id === 'a' ? 'b' : 'a')

// Double-buffered live tileset. The backend regenerates tileset.json on
// every request at the same url, but Tile3DLayer keys its loaded state off
// the exact url string — so each poll gets a cache-busting `t` param to
// force a real reload. Each poll loads into the off-screen slot while the
// on-screen one keeps showing, so the scene never shows a half-loaded
// tileset. A poll is skipped while the back slot is still loading: polling
// faster than a tileset can load would otherwise restart it forever and
// nothing would ever be promoted. A null url (not known yet) means don't poll.
export function useLiveTileset(tilesetUrl: string | null, pollMs: number): LiveTileset {
  const [slots, setSlots] = useState<{ front: TilesetSlot | null; back: TilesetSlot | null }>({
    front: null,
    back: null,
  })

  useEffect(() => {
    if (!tilesetUrl) return
    const tick = () => {
      const url = new URL(tilesetUrl)
      url.searchParams.set('t', String(Date.now()))
      const label = `live @ ${new Date().toLocaleTimeString()}`
      setSlots(prev => {
        if (prev.back) return prev
        // First load: nothing to hide behind, so show it progressively.
        if (!prev.front) return { front: { id: 'a', url: url.toString(), label }, back: null }
        // Two ticks in the same millisecond (StrictMode runs this effect
        // twice in dev) would produce the same url — skip the duplicate.
        if (prev.front.url === url.toString()) return prev
        return { ...prev, back: { id: otherSlot(prev.front.id), url: url.toString(), label } }
      })
    }
    tick()
    const id = setInterval(tick, pollMs)
    return () => clearInterval(id)
  }, [tilesetUrl, pollMs])

  const promoteBack = useCallback(() => {
    setSlots(prev => (prev.back ? { front: prev.back, back: null } : prev))
  }, [])

  return { ...slots, promoteBack }
}

import { Tile3DLayer, type Tile3DLayerProps } from '@deck.gl/geo-layers'
import { Tiles3DLoader } from '@loaders.gl/3d-tiles'
import type { TilesetEntry } from '../hooks/useLiveTileset'

const TILE_CACHE_MB = 32
const MAX_SCREEN_SPACE_ERROR = 8
const MAX_TILES_SELECTED = 800
const SELECTION_DEBOUNCE_MS = 150
const MAX_CONCURRENT_TILE_REQUESTS = 12

type Callbacks = Pick<Tile3DLayerProps, 'onTilesetLoad' | 'onTileError'>

export function makeTilesetLayer({ url }: TilesetEntry, callbacks: Callbacks) {
  return new Tile3DLayer({
    // Stable per url: deck.gl matches layers by id across renders, so a
    // re-render keeps an already-loaded tileset instead of reloading it.
    id: `tileset-${url}`,
    data: url,
    loaders: [Tiles3DLoader],
    loadOptions: {
      tileset: {
        maximumMemoryUsage: TILE_CACHE_MB,
        maximumScreenSpaceError: MAX_SCREEN_SPACE_ERROR,
        maximumTilesSelected: MAX_TILES_SELECTED,
        debounceTime: SELECTION_DEBOUNCE_MS,
        throttleRequests: true,
        maxRequests: MAX_CONCURRENT_TILE_REQUESTS,
      },
    },
    pointSize: 2,
    ...callbacks,
  })
}

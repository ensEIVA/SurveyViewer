import { Tile3DLayer, type Tile3DLayerProps } from '@deck.gl/geo-layers'
import { Tiles3DLoader } from '@loaders.gl/3d-tiles'
import type { TilesetSlot } from '../hooks/useLiveTileset'

const TILE_CACHE_MB = 32
const MAX_SCREEN_SPACE_ERROR = 4
const MAX_TILES_SELECTED = 800
const SELECTION_DEBOUNCE_MS = 150
const MAX_CONCURRENT_TILE_REQUESTS = 12

type Callbacks = Pick<Tile3DLayerProps, 'onTilesetLoad' | 'onTileError'>

// `offscreen`: the double buffer's back slot. Not `visible: false` —
// deck.gl only tells a layer where the camera is when it actually draws it,
// so a hidden Tile3DLayer never selects or loads any tiles beyond the root.
// Instead it's drawn fully transparent, with depth writes off so its
// invisible points can't hide the on-screen layer's points behind them.
// `datasetId` keeps layer ids unique when several datasets share a scene.
export function makeTilesetLayer(
  datasetId: string,
  { id, url }: TilesetSlot,
  offscreen: boolean,
  callbacks: Callbacks,
) {
  return new Tile3DLayer({
    // Per slot, not per url: deck.gl matches layers by id across renders,
    // so a slot keeps its loaded tileset when it moves between back and
    // front, and only reloads when its url changes.
    id: `tileset-${datasetId}-${id}`,
    data: url,
    opacity: offscreen ? 0 : 1,
    parameters: { depthWriteEnabled: !offscreen },
    pickable: false,
    loaders: [Tiles3DLoader],
    loadOptions: {
      tileset: {
        // maximumMemoryUsage: TILE_CACHE_MB,
        maximumScreenSpaceError: MAX_SCREEN_SPACE_ERROR,
        // maximumTilesSelected: MAX_TILES_SELECTED,
        // debounceTime: SELECTION_DEBOUNCE_MS,
        // throttleRequests: true,
        // maxRequests: MAX_CONCURRENT_TILE_REQUESTS,
      },
    },
    pointSize: 4,
    ...callbacks,
  })
}

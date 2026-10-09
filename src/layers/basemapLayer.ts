import { TileLayer } from '@deck.gl/geo-layers'
import { BitmapLayer } from '@deck.gl/layers'

// Esri World Imagery: free for development and non-commercial use; production
// use falls under Esri's terms and needs an account/licence. Needs internet.
const BASEMAP_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

// Esri's terms require this to be shown wherever the imagery is.
export const BASEMAP_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'

// Satellite imagery of the earth under the point clouds. Always drawn
// behind everything: survey data is often below sea level (negative Z), and
// a map plane at height 0 taking part in depth testing would hide every
// seabed point under it. So it neither tests nor writes depth, and must be
// the first layer in the list.
export function makeBasemapLayer() {
  return new TileLayer({
    id: 'basemap',
    data: BASEMAP_URL,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    parameters: { depthCompare: 'always', depthWriteEnabled: false },
    renderSubLayers: props => {
      const [[west, south], [east, north]] = props.tile.boundingBox
      return new BitmapLayer(props, { data: undefined, image: props.data, bounds: [west, south, east, north] })
    },
  })
}

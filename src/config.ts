// Nexus — the only backend this viewer talks to (it fronts Meridian).
// Answers NexusService over grpc-web, and serves tileset.json/.pnts and
// recent points over plain HTTP.
// Defaults to a Nexus running locally; point at another one via
// .env.local (VITE_API_URL=http://<host>:<port>).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5007'

// Node whose description endpoint (tileset url) is asked for at startup.
export const ROOT_NODE_ID = '0'

// How often Nexus is asked again for the root's description endpoint.
export const NODE_ENDPOINT_POLL_MS = 1000

export const TILESET_POLL_MS = 5_000

export const RECENT_POINTS_POLL_MS = 1000

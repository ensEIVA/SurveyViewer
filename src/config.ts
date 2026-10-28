// Nexus — the only backend this viewer talks to (it fronts Meridian).
// Answers NexusService over grpc-web, and serves tileset.json/.pnts over
// plain HTTP.
// Defaults to a Nexus running locally; point at another one via
// .env.local (VITE_API_URL=http://<host>:<port>).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5007'

// Fletcher gateway — where the live-point and vessel-position topics come
// from, bridged from Nexus over DDS. Runs on this machine by default;
// override via .env.local (VITE_GATEWAY_URL=ws://<host>:<port>).
export const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'ws://localhost:9090'

// Node, within the chosen dataset, whose description endpoint (tileset url)
// is asked for at startup.
export const ROOT_NODE_ID = '0'

// How often Nexus is asked again for the root's description endpoint.
export const NODE_ENDPOINT_POLL_MS = 10000

export const TILESET_POLL_MS = 5_000

// Measurements panel: a pause counts as a gap when it's longer than this many
// times the stream's median interval (3 on a 1 Hz stream: over 3 s). The
// starting value; it can be changed in the panel while measuring.
export const MEASUREMENT_GAP_FACTOR = 3

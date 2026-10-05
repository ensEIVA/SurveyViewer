// Nexus — the only backend this viewer talks to (it fronts Meridian).
// Serves tileset.json/.pnts and recent points over plain HTTP.
// Overridable per environment via .env (VITE_API_URL=...).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:2008'

export const TILESET_POLL_MS = 10_000

export const RECENT_POINTS_POLL_MS = 1_000

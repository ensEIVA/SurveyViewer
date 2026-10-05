// Backend serving tileset.json/.pnts (OctreeLod.Server or Meridian).
// Overridable per environment via .env (VITE_API_URL=...).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:2008'

export const TILESET_POLL_MS = 10_000

# SurveyViewer

Browser 3D viewer for live survey point clouds and vessels, fed by **Nexus**. React + TypeScript + deck.gl.

## Quick start

You need Node.js and a running Nexus.

1. Install:
   ```
   npm install
   ```
2. Point it at Nexus. Create `.env.local`:
   ```
   VITE_API_URL=http://<nexus-host>:5007
   ```
3. Start the gateway (live data), in its own terminal:
   ```
   npm run gateway
   ```
4. Start the viewer, in another terminal:
   ```
   npm run dev
   ```
5. Open http://localhost:2008, then add a dataset or vessel at the top.

In VS Code, **F5** starts the viewer and opens Chrome with the debugger attached.

## Settings

| Variable | Where | Default | What |
|---|---|---|---|
| `VITE_API_URL` | `.env.local` | `http://localhost:5007` | Nexus |
| `VITE_GATEWAY_URL` | `.env.local` | `ws://localhost:9090` | Fletcher gateway |
| `FLETCHER_DOMAIN_ID` | shell, for `npm run gateway` | `0` | Nexus's DDS domain |
| `GATEWAY_PORT` | shell, for `npm run gateway` | `9090` | Gateway port (match `VITE_GATEWAY_URL`) |
| `GATEWAY_PROVIDER_CONFIG` | shell, for `npm run gateway` | `scripts/gateway-profiles.xml` | Fast DDS profiles |

The viewer must run on port 2008: Nexus's CORS allows only that origin.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Viewer on http://localhost:2008 |
| `npm run gateway` | Fletcher gateway on ws://localhost:9090 (downloads it on first run) |
| `npm test` | Unit tests |
| `npm run lint` | Lint |
| `npm run build` | Type-check and production build |
| `npm run generate` | Regenerate `src/gen/` from `proto/` |

## Troubleshooting

- **"Failed to fetch" for datasets or vessels:** Nexus isn't reachable at `VITE_API_URL`.
- **No live points or vessels, but datasets load:** the gateway isn't running, or Nexus publishes on another domain (`FLETCHER_DOMAIN_ID`). Run only one gateway per machine.
- **Port 2008 in use:** another `npm run dev` is still running.

## How it works

```
Browser ──gRPC-Web──▶ Nexus     lists, colour mode, tileset URL
        ◀─WebSocket─  gateway   live points, vessel positions (bridged from Nexus over DDS)
        ──HTTP GET──▶ Nexus     3D Tiles (tileset.json + .pnts)
        ──HTTP GET──▶ Esri      basemap
```

- **gRPC-Web** for queries. Contract: `proto/nexus/v1/nexus_service.proto`.
- **Fletcher gateway** for live data: Nexus publishes on DDS, and the gateway on this machine forwards it over a WebSocket. Every topic carries all datasets and vessels; the viewer keeps the ones it shows. Contract: `proto/nexus/v1/nexus_topics.proto`. Connection code: `src/services/gateway.ts`.
- **HTTP** for tiles, so the browser can cache them.

## Features

| Feature | How |
|---|---|
| Scenes | Side-by-side panes, each with its own camera; layout saved in the browser. |
| Datasets | One or more per scene, from Nexus's list. |
| Point cloud | 3D Tiles, reloaded every 5 s; swaps only when fully loaded. |
| Live points | Newest points on top, about once a second; toggle per dataset. |
| Colours | Attribute + palette, shared by all users. |
| Vessels | 3D hull with roll/pitch/heading; grey when over 10 s stale. |
| Follow | Camera follows a vessel; pauses 2 s after you pan. |
| Measurements | Rate, latency and gaps per stream; CSV export. |

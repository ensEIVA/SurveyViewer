# SurveyViewer

Browser 3D viewer for live survey point clouds and vessels. React + TypeScript + deck.gl. Talks only to **Nexus**.

## Status

- Branch `feature/datasets`, running against Nexus on a colleague's machine. No automated tests yet.
- Open in the contract: vessel height reference (ellipsoid vs sea level) and update rate.
- `npm run build` fails: unused constants in `src/layers/tilesetLayer.ts` (tile-tuning experiment).
- Spike AB#21307 (deck.gl over gRPC): answered — tiles stay on HTTP; posting the conclusion is pending.

## Features

| Feature | How |
|---|---|
| Scenes | Several side-by-side panes, each with its own camera. Layout saved in the browser. |
| Datasets | Pick one or more per scene from Nexus' list. |
| Point cloud | 3D Tiles from Nexus, reloaded every 5 s; swaps only when fully loaded (no flicker). |
| Live points | Newest ≤300k points on top, streamed ~1/s; toggle per dataset. |
| Colours | Attribute + palette, shared by all users; changing it reloads tiles. |
| Vessels | 3D hull with roll/pitch/heading; grey when >10 s stale. |
| Follow | Camera eases after a vessel; pauses 2 s after manual panning. |
| Basemap | Esri satellite imagery under every scene. |
| Readouts | Status, camera position, FPS/memory per scene. |

## Network

```
Browser ──gRPC-Web──▶ Nexus   lists, colour mode, tileset URL
        ◀─stream────  Nexus   live points, vessel positions (1 stream each, auto-reconnect)
        ──HTTP GET──▶ Nexus   tileset.json + .pnts (deck.gl loads these itself, browser-cached)
        ──HTTP GET──▶ Esri    basemap tiles (internet)
```

- **gRPC-Web** (Connect, binary protobuf) for commands, queries and streams. Contract: `proto/nexus/v1/nexus_service.proto`, client generated into `src/gen/` (`npm run generate`).
- **Plain HTTP** for tiles: the 3D Tiles standard is URL-based, and `GET` keeps browser caching.
- Each open stream uses one of the browser's 6 connections to Nexus.

## Run

```
npm install
npm run dev        # http://localhost:2008 — Nexus' CORS allows only this origin
```

Nexus address: `VITE_API_URL` in `.env.local` (default `http://localhost:5007`).

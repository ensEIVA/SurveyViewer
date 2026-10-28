# SurveyViewer

Browser 3D viewer for live survey point clouds and vessels. React + TypeScript + deck.gl. Talks to **Nexus**, and to a **Fletcher gateway** on this machine for its live data.

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
Browser ──gRPC-Web──▶ Nexus     lists, colour mode, tileset URL
        ◀─WebSocket─  Fletcher  live points, vessel positions (topics, bridged from Nexus over DDS)
        ──HTTP GET──▶ Nexus     tileset.json + .pnts (deck.gl loads these itself, browser-cached)
        ──HTTP GET──▶ Esri      basemap tiles (internet)
```

- **gRPC-Web** (Connect, binary protobuf) for commands and queries. Contract: `proto/nexus/v1/nexus_service.proto`, client generated into `src/gen/` by buf. Its `GetLivePoints` and `GetVesselPosition` streams are still served but unused.
- **Fletcher gateway** (WebSocket, `@eiva/fletcher-gateway-client`) for the live data: Nexus publishes on DDS, the gateway bridges it to the browser. One shared connection (`src/services/gateway.ts`) subscribes each topic once, checks itself every 2 s and reconnects with backoff. Each topic carries every dataset or vessel; the viewer keeps the rows it shows. Contract: `proto/nexus/v1/nexus_topics.proto`, row schemas generated into `src/gen/` by `protoc-gen-fletcher`, as the backend does.
- **Plain HTTP** for tiles: the 3D Tiles standard is URL-based, and `GET` keeps browser caching.

`npm run generate` regenerates both from `proto/`.

## Run

```
npm install
npm run dev        # http://localhost:2008 — Nexus' CORS allows only this origin
```

Needs a Fletcher gateway bridging Nexus's DDS domain, e.g. `gateway --port 9090 --provider fastdds --domain-id <Nexus's domain>` ([releases](https://github.com/eivacom/Fletcher/releases?q=gateway)).

Addresses in `.env.local`: Nexus `VITE_API_URL` (default `http://localhost:5007`), gateway `VITE_GATEWAY_URL` (default `ws://localhost:9090`).

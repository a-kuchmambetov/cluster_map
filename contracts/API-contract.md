
/
















Api contract · MD
# API Contract — Cluster Map
 
Deliverable for the Trello card **"Define API contracts"**. Written per the requested structure: for every route — the route, its input values (body / query / params), and the response structure.
 
Finalized per Maxim's review (2026-08-05), Artem's confirmation (2026-08-05), and the call with Valentine (2026-08-06). Based on the project docs (`reference/api`, `reference/map-configuration`, `architecture/domain-model-and-data-flow`, `product/*`).
 
**Legend:** 🟢 fixed in code · 🟡 proposal (needs sign-off).
 
Base prefix for all paths: **`/api`**. All responses are JSON.
 
> **Route naming — resolved.** `GET /api/map/:id` in the Trello card was just a general example of route structure (`METHOD /api/route/:param`), not a specific requirement (confirmed by Artem, 2026-08-05). The docs paths below (`GET /api/clusters/:clusterNumber/map` etc.) are final.
 
---
 
## 1. Error format 🟢 (already in code)
 
Every error uses one shape:
```json
{
  "ok": false,
  "status": "fail",
  "code": "VALIDATION_ERROR",
  "error": "Human-readable message",
  "details": [
    { "path": "clusterNumber", "message": "Expected positive integer", "code": "too_small" }
  ]
}
```
- `details` is not always present (an array for validation errors, otherwise may be omitted).
- With `NODE_ENV=production`, 5xx messages are masked ("Internal server error") and `details` is dropped.
Status codes:
 
| Case | HTTP | `code` |
|---|---|---|
| Malformed JSON body | `400` | `BAD_REQUEST` |
| Request failed Zod validation | `422` | `VALIDATION_ERROR` |
| Cluster/resource not found | `404` | `CLUSTER_NOT_FOUND` |
| Unexpected server/DB error | `500` | `INTERNAL_SERVER_ERROR` |
 
---
 
## 2. `GET /api/health` 🟢 (done)
 
**Input:** none (no params, no query, no body).
 
**Response** `200`:
```json
{ "status": "ok" }
```
Does not touch the DB; only confirms the process is alive.
 
---
 
## 3. `GET /api/clusters` 🟢 — list of clusters
 
Returned from the layout config (not the production DB). Lets the frontend render the cluster picker.
 
**Input:** none.
 
**Response** `200`:
```json
{
  "clusters": [
    { "id": "c1", "number": 1, "label": "Cluster 1" },
    { "id": "c2", "number": 2, "label": "Cluster 2" }
  ]
}
```
- `id` — stable machine id from the config.
- `number` — user-facing number, also used in the map URL.
- `label` — UI caption.
No free-place count needed here — confirmed by Maxim, `summary` in `/map` is enough (frontend can derive vacancy per-cluster from `getClusterOccupancy` results without a dedicated endpoint).
 
---
 
## 4. `GET /api/clusters/:clusterNumber/map` 🟢 — main endpoint
 
Returns the cluster layout merged with current occupancy.
 
**Input:**
- Path params: `clusterNumber` — positive integer (e.g. `1`). Validated with Zod; invalid → `422`.
- Query: none.
- Body: none.
**Response** `200`:
```json
{
  "cluster": { "id": "c1", "number": 1, "label": "Cluster 1" },
  "rows": [
    {
      "id": "c1r1",
      "number": 1,
      "label": "Row 1",
      "cells": [
        { "kind": "place", "id": "c1r1p1", "number": 1, "status": "free", "peer": null },
        { "kind": "gap" },
        {
          "kind": "place", "id": "c1r1p2", "number": 2, "status": "occupied",
          "peer": { "intraName": "jdoe", "displayName": "John Doe", "photo": null }
        }
      ]
    }
  ],
  "summary": { "free": 1, "occupied": 1, "total": 2 },
  "lastUpdated": "2026-07-30T10:00:00Z",
  "warnings": []
}
```
 
Field meanings:
- `cluster` — `{ id, number, label }`.
- `rows[]` — rows in order; each `{ id, number, label, cells[] }`.
- `cells[]` — positions in a row, **in order**. A cell is one of two kinds:
  - `{ "kind": "place", "id", "number", "status", "peer" }`
  - `{ "kind": "gap" }` — visual spacer, no number, no interaction.
- `status` (enum): `"free"` | `"occupied"`.
  - A place with no matching occupancy record is treated as `"free"` — confirmed by Maxim (2026-08-05).
- `peer`:
  - `null` when free;
  - `{ "intraName": string | null, "displayName": string | null, "photo": string | null }` when occupied.
  - **`intraName` is not always present** — guest accounts (registered directly on the site, without Hive login) may lack it. Same for `displayName`.
  - `photo` added per the call with Valentine (2026-08-06) — the cluster map prioritizes photo + login for identification, matching the current 42/Hive cluster map.
  - No `email` — explicitly decided unnecessary per privacy rules.
  - Both `intraName` and `displayName` are passed through as-is from the occupancy source — no fallback or priority logic is applied. Either field may be `null`. Presentation (which to show, in what order) is the frontend's decision (confirmed by Maxim, 2026-08-26).
- `summary` — `{ free, occupied, total }`; `total` = number of real places (excluding gaps).
- `lastUpdated` — ISO 8601 time of the last **successful** occupancy read; `null` if never.
- `warnings[]` — layout/occupancy mismatches. Shape: `{ "code": string, "message": string }`. The valid part of the map stays; no internal DB/config details leak here.
**Response** errors:
- `422` — malformed `clusterNumber`.
- `404 CLUSTER_NOT_FOUND` — no such cluster in the config.
- `500` — production DB unavailable (frontend keeps the last successful map).
"Stale" is computed by the **frontend** from `lastUpdated` — confirmed by Maxim (2026-08-05). Threshold is a frontend-side decision, not part of this contract.
 
---
 
## 5. `GET /api/clusters/:clusterNumber/config-validation` 🟡
 
Returns validation errors for the selected cluster's layout config.
 
**Input:**
- Path params: `clusterNumber` — positive integer.
- Query: none.
- Body: none.
**Response** `200`:
```json
{ "clusterNumber": 1, "valid": true, "errors": [] }
```
On errors:
```json
{
  "clusterNumber": 1,
  "valid": false,
  "errors": [
    { "code": "DUPLICATE_PLACE_ID", "message": "Place id c1r1p2 is not unique", "path": "clusters[0].rows[0].cells[2].id" }
  ]
}
```
 
---
 
## 6. Open items to confirm — all resolved ✅
 
- [x] Route path: `/api/clusters/:clusterNumber/map` — confirmed final by Artem (2026-08-05).
- [x] `/map` shape (cells + kind) — confirmed by Maxim (2026-08-05).
- [x] `peer` = `intraName` + `displayName` (+ `photo` added 2026-08-06) — confirmed sufficient.
- [x] Free place = `status: "free"` (not `"unknown"`) — confirmed by Maxim.
- [x] "Stale" computed by frontend from `lastUpdated` — confirmed by Maxim.
- [x] `warnings` shape (`code` + `message`) — confirmed sufficient by Maxim.
---
 
## 7. Notes
 
- These paths are marked **not implemented** in the docs — this contract locks them before code.
- Once agreed, a mock endpoint with this shape can ship immediately so the frontend doesn't wait for the production DB.
- Field names are camelCase (`intraName`, `displayName`, `photo`).
- **Realtime strategy is out of scope for this file.** Artem is prototyping SSE (server-sent events) as an alternative to fixed-interval polling, per subject requirements around realtime updates. This contract's `GET /map` endpoint is unaffected either way; if/when an SSE endpoint is added, it will be documented here as a new section once the prototype is confirmed — not updated speculatively now.
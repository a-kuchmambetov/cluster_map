
/
















Api contract · MD
# API Contract — Cluster Map
 
Deliverable for the Trello card **"Define API contracts"**. Written per the requested structure: for every route — the route, its input values (body / query / params), and the response structure.
 
Finalized per Maxim's review (2026-08-05), Artem's confirmation (2026-08-05), and the call with Valentine (2026-08-06). Based on the project docs (`reference/api`, `reference/map-configuration`, `architecture/domain-model-and-data-flow`, `product/*`).
 
**Legend:** 🟢 fixed in code · 🟡 proposal (needs sign-off).
 
Base prefix for all paths: **`/api`**. All responses are JSON.
 
> **Route naming — resolved.** `GET /api/map/:id` in the Trello card was just a general example of route structure (`METHOD /api/route/:param`), not a specific requirement (confirmed by Artem, 2026-08-05). The merged `/map` endpoint has been replaced with separate `/layout` and `/occupancy` endpoints per the 2026-08-27 call (Artem, issue #8).
 
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
No free-place count needed here — the cluster picker doesn't need vacancy stats. A client that wants totals can derive them from /layout (total places) and /occupancy (occupied count).
 
---
 
## 4. `GET /api/clusters/:clusterNumber/layout` 🟡 — static cluster layout
 
Returns the cluster's physical layout from the config file. No DB query; responds instantly.
 
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
        { "kind": "place", "id": "c1r1p1", "number": 1, "position": "top" },
        { "kind": "gap" },
        { "kind": "place", "id": "c1r1p2", "number": 2 }
      ]
    }
  ]
}
```
 
Field meanings:
- `cluster` — `{ id, number, label }`.
- `rows[]` — rows in top-to-bottom physical order (highest row number first). The frontend can render them in array order without sorting. In the HIVE layout R6 is the topmost row, so `rows[0]` is always R6 and `rows[rows.length - 1]` is always R1. Each row: `{ id, number, label, cells[] }`.
- `cells[]` — positions in a row, **in order**. A cell is one of two kinds:
  - `{ "kind": "place", "id", "number", "position"? }` — a real, numbered seat.
  - `{ "kind": "gap" }` — visual spacer, no number, no interaction.
- `position` — `"top"` | `"bottom"`, optional. If absent, the rendering layer takes the opposite of the nearest preceding non-gap place in the same row. The first place in every row carries an explicit value in the config.
  - Stored in the config rather than derived at render time, because the parity formula (place number mod 2) breaks when a row splits. Only places that break the alternating pattern need an explicit value; an ordinary alternating row needs no markup beyond the first place.
 
No `status`, no `peer`, no `summary` — occupancy belongs to /occupancy; totals are trivially derivable by the frontend.
 
**Response** errors:
- `422` — malformed `clusterNumber`.
- `404 CLUSTER_NOT_FOUND` — no such cluster in the config.
 
---
 
## 5. `GET /api/clusters/:clusterNumber/occupancy` 🟡 — live occupancy
 
Returns only the currently **occupied** places. Every place not listed is free by implication. Requires a DB query.
 
**Input:**
- Path params: `clusterNumber` — positive integer. Validated with Zod; invalid → `422`.
- Query: none.
- Body: none.
 
**Response** `200`:
```json
{
  "occupied": [
    {
      "row": 1,
      "place": 2,
      "peer": { "intraName": "jdoe", "displayName": "John Doe", "photo": null }
    }
  ],
  "lastUpdated": "2026-08-27T10:00:00Z"
}
```
 
Field meanings:
- `occupied[]` — one entry per occupied place.
  - `row` — row number within the cluster (matches `ClusterRow.number` from /layout).
  - `place` — place number within that row (matches `PlaceCell.number` from /layout).
  - `peer` — `{ "intraName": string | null, "displayName": string | null, "photo": string | null }`. Both name fields passed through raw from the DB — no fallback or priority logic applied. Either may be `null`. Presentation is the frontend's decision (confirmed by Maxim, 2026-08-26).
  - **`intraName` is not always present** — guest accounts (registered directly on the site, without Hive login) may lack it. Same for `displayName`.
  - `photo` — avatar URL or `null`; frontend uses a default photo when null. Added per the call with Valentine (2026-08-06), matching what the 42/Hive cluster map shows.
  - No `email` — explicitly excluded per privacy rules.
  - **A place can appear in `occupied[]` with all three peer fields `null`.** Valentine's schema has a separate `occupied` boolean and a nullable `holderId` FK; the query filters on `occupied = true` and left-joins the holder. A seat marked occupied with no holder produces a valid record with no peer data. The frontend should render it as occupied (seat is taken) but with no name or photo to display.
- Places are identified by `row`/`place` numbers rather than config IDs. The frontend already holds the layout from /layout and joining two numbers against it is trivial.
- `lastUpdated` — ISO 8601 time of the last **successful** DB read; `null` if never.
 
**No `summary`** — `occupied` count is `occupied.length`; total places is countable from /layout; `free = total - occupied`. Both are trivial for the frontend and emitting them here would require this endpoint to read the config, re-coupling layout and occupancy server-side.
 
**Matching:** the frontend fetches /layout and /occupancy independently. To render, it marks each `PlaceCell` occupied if `(row.number, cell.number)` appears in `occupied[]`, free otherwise.
 
"Stale" is computed by the **frontend** from `lastUpdated` — confirmed by Maxim (2026-08-05). Threshold is a frontend-side decision, not part of this contract.
 
**Response** errors:
- `422` — malformed `clusterNumber`.
- `404 CLUSTER_NOT_FOUND` — no such cluster in the config.
- `500` — production DB unavailable (frontend keeps the last successful occupancy).
 
---
 
## 6. `GET /api/clusters/:clusterNumber/config-validation` 🟡
 
Checks whether the layout config is consistent with what the database currently reports.
 
The config file is always structurally valid — Zod catches schema problems at load time. This endpoint checks for a semantic mismatch: if the database returns occupancy for a place that doesn't exist in the config (wrong row number or place number), the config is likely out of date. The site should surface a message asking someone to review it.
 
**Input:**
- Path params: `clusterNumber` — positive integer.
- Query: none.
- Body: none.
 
**Response** `200`:
```json
{ "clusterNumber": 1, "valid": true, "errors": [] }
```
On mismatch:
```json
{
  "clusterNumber": 1,
  "valid": false,
  "errors": [
    { "code": "ORPHANED_OCCUPANCY", "message": "DB record for row 2, place 5 has no matching place in the layout", "path": "clusters[0]" }
  ]
}
```
- `valid: false` means the DB returned occupancy the config cannot account for. The database is the source of truth; the config is what's likely wrong.
- `errors[].code` — machine-readable mismatch category.
- `errors[].message` — human-readable description.
- `errors[].path` — location in the config where the mismatch is anchored.
 
---
 
## 7. Open items
 
- [x] Route path: `/api/clusters/:clusterNumber/layout` and `/api/clusters/:clusterNumber/occupancy` — decided on the 2026-08-27 call (Artem), replaces `/map`. See issue #8.
- [x] `/layout` shape (cells + kind + position field) — defined per the 2026-08-27 call.
- [x] `/occupancy` identifies places by row/place numbers, not config IDs — decided in issue #8.
- [x] No `summary` emitted by either endpoint — decided in issue #8.
- [x] Free place is implied by absence from `occupied[]`, not by an explicit `status: "free"` field — decided on the 2026-08-27 call.
- [x] `peer` = `intraName` + `displayName` + `photo` — confirmed sufficient (Valentine call 2026-08-06).
- [x] Both name fields passed through raw, presentation is frontend's decision — confirmed by Maxim (2026-08-26).
- [x] "Stale" computed by frontend from `lastUpdated` — confirmed by Maxim (2026-08-05).
- [x] `warnings` shape (`code` + `message`) — confirmed sufficient by Maxim.
- [x] Config-validation checks DB-config mismatch, not structural validity — decided on the 2026-08-27 call.
 
---
 
## 8. Notes
 
- These paths are marked **not implemented** in the docs — this contract locks them before code.
- Once agreed, mock endpoints with these shapes can ship immediately so the frontend doesn't wait for the production DB.
- Field names are camelCase (`intraName`, `displayName`, `photo`).
- **Realtime strategy is out of scope for this file.** The mechanism for pushing occupancy updates is not yet settled — both SSE (server-sent events) and WebSocket were mentioned on the 2026-08-27 call; no decision has been made. The `/occupancy` endpoint described here is unaffected either way; if/when a push channel is added, it will be documented as a new section once confirmed, not updated speculatively now.
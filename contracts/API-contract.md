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
    "details": [{ "path": "clusterNumber", "message": "Expected positive integer", "code": "too_small" }]
}
```

- `details` is not always present (an array for validation errors, otherwise may be omitted).
- With `NODE_ENV=production`, 5xx messages are masked ("Internal server error") and `details` is dropped.
  Status codes:

| Case                          | HTTP  | `code`                  |
| ----------------------------- | ----- | ----------------------- |
| Malformed JSON body           | `400` | `BAD_REQUEST`           |
| Request failed Zod validation | `422` | `VALIDATION_ERROR`      |
| Cluster/resource not found    | `404` | `CLUSTER_NOT_FOUND`     |
| Unexpected server/DB error    | `500` | `INTERNAL_SERVER_ERROR` |

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

## 7. `GET /api/clusters/:clusterNumber/events` 🟡 — live occupancy stream (SSE)

Pushes occupancy changes to the client as a server-sent event stream. One connection per cluster per client. The server polls the DB once per active cluster regardless of how many clients are watching it.

**Decided 2026-09-12 (Artem).** Mechanism is SSE (not WebSocket). One direction only: server → client.

### Load sequence

The client always calls `/layout` and `/occupancy` first to get the initial state, then opens this connection. SSE carries only changes from that point on. The stream does not replay the current state on connect.

```
1. GET /layout       → renders the grid
2. GET /occupancy    → marks initial occupied seats
3. GET /events  →  stream opens; receives deltas as they occur
```

### Input

- Path params: `clusterNumber` — positive integer. Validated with Zod; invalid → `422` before the stream opens.
- Query: none.
- Body: none.
- Required headers: `Accept: text/event-stream` (browser `EventSource` sets this automatically).

### Response — stream open

Status: `200 OK`
Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

The response body is a continuous SSE stream. The connection stays open until the client closes it or the server shuts down. All events use named types so the client can use `addEventListener` rather than `onmessage`.

#### `occupancy-delta` event

Sent when the poll detects a change. Not sent if nothing changed.

```
event: occupancy-delta
data: {"occupied":[{"row":1,"place":2,"peer":{"intraName":"jdoe","displayName":"John Doe","photo":null}}],"freed":[{"row":1,"place":5}]}

```

Fields:
- `occupied[]` — places that became occupied since the last poll, or places that were already occupied but whose peer data changed. Same shape as `/occupancy`'s entries.
- `freed[]` — places that were occupied and are now free. Identified by `{ row, place }` only; no peer data (the seat is empty).

> **Decision — delta shape.** A feed of only current occupied places cannot express "this place is now free": the client holds the last-known state and seeing a place drop out of the list is ambiguous with a missed event. An explicit `freed` list removes that ambiguity. An alternative — separate `place-occupied` and `place-freed` event types — would mean the client has to handle two handlers and think about ordering across a reconnect; a single event type with two fields is simpler. Artem: push back here if you'd prefer two event types.

The client applies the delta to its local state: upsert every entry in `occupied`, remove every entry in `freed`. An event where both arrays are empty is never sent.

#### `error` event

Sent when the DB is unreachable during a poll cycle. The connection stays open.

```
event: error
data: {"code":"DB_UNAVAILABLE","message":"Occupancy data temporarily unavailable"}
```

> **Decision — DB unavailable.** Dropping all connections on a transient DB failure causes a reconnect storm and loses the client's rendered state. Silence is worse: the client cannot distinguish "nothing changed" from "we don't know". An `error` event lets the client show a staleness indicator while keeping the connection open. What the client should do after repeated errors (e.g. fall back to polling `/occupancy`, close the connection, or surface a degraded-mode UI) is a frontend decision — open item for Maxim.

#### Keepalive comments

A comment line is sent every 20 seconds of inactivity to prevent proxies from closing idle connections. Comment lines are invisible to `EventSource` handlers.

```
: keep-alive

```

> **Note — proxy timeouts.** The deployment sits behind Cloudflare and a reverse proxy, both of which close idle connections after an unverified timeout. The poll interval is 30 seconds, so a cluster with no changes can be silent for up to 30 seconds. The 20-second comment interval keeps the connection alive through both layers.

### Server-side polling

- One polling timer per active cluster (a cluster is active while it has at least one subscriber).
- Poll interval: **30 seconds**, matching `product/requirements-and-user-journeys.mdx`. Subject to tuning.
- A shared occupancy snapshot per cluster is held in process memory and used by both `/occupancy` and the poller (see decision below). On each poll cycle the poller reads the DB, diffs against the snapshot, emits a delta if anything changed, then overwrites the snapshot.

> **Decision — last subscriber disconnects.** When the last client for a cluster closes its connection, the polling timer is stopped and the cluster is removed from the poll pool. Polling an unwatched cluster wastes a DB read every 30 seconds with no recipient; stopping immediately is the right call. The shared snapshot is **not** discarded — it is process-level state, not owned by the poller. When the next client calls `/occupancy` (as the load sequence requires), it writes a fresh state into the snapshot; the SSE seed then has something to work from rather than starting cold. The next client to open SSE restarts the poll timer.

> **Decision — shared snapshot closes the cold-start window (Artem, 2026-09-13).** A single snapshot per cluster is held in process memory and shared between `/occupancy` and the SSE poller. `/occupancy` writes to it on every call. When an SSE connection starts and its cluster's snapshot is empty, the poller seeds from the shared snapshot — which holds the newest state the client has already seen — before the first poll runs. The first poll then diffs against that state rather than against nothing, so any change between the `/occupancy` call and the first SSE poll produces a delta instead of being missed. The snapshot continues to update on change as normal.
>
> **Note.** The shared snapshot is in process memory. With more than one API process, a client can fetch `/occupancy` on one instance and open SSE on another whose shared snapshot belongs to a different client or is empty, restoring the cold-start window. This design holds for a single process; do not assume it survives horizontal scaling.
>
> **Note.** If no client has called `/occupancy` for a cluster since the process started, the shared snapshot is empty and the first poll still reads as "everything changed." In practice the client always calls `/occupancy` before opening SSE, so this is uncommon, but the behaviour is the same as the rejected silent-init approach in that case.
>
> **Possibility (not doing this now).** Because the shared snapshot is always up to date, `/occupancy` could read from it rather than querying the DB on every call, turning the endpoint into a cache read. Not in scope yet, but the structure supports it.

### Reconnect

SSE's built-in `EventSource` reconnect is not sufficient here. After a disconnect the client may have missed an arbitrary number of events, and the server does not replay history.

**Required reconnect sequence:**

1. On `EventSource` `error` or `close`, wait for the browser's built-in backoff (or implement your own).
2. Before re-opening the SSE connection, re-fetch `/occupancy` to resync local state.
3. Open a new SSE connection.

The `Last-Event-ID` header sent by `EventSource` on reconnect is ignored by the server; no event IDs are assigned because there is no replay buffer.

### Response errors (before the stream opens)

- `422` — malformed `clusterNumber`.
- `404 CLUSTER_NOT_FOUND` — no such cluster in the config.

Once the stream is open, errors are delivered as `error` events (see above), not as HTTP status codes.

---

## 8. Open items
 
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
- [ ] **SSE — client behaviour on repeated `DB_UNAVAILABLE` errors.** The server keeps the connection open; what the client does (fall back to polling `/occupancy`, show a degraded-mode indicator, close and reconnect, etc.) is a frontend decision. Maxim to weigh in.
 
---
 
## 9. Notes

- These paths are marked **not implemented** in the docs — this contract locks them before code.
- Once agreed, mock endpoints with these shapes can ship immediately so the frontend doesn't wait for the production DB.
- Field names are camelCase (`intraName`, `displayName`, `photo`).
- **Realtime mechanism: SSE.** Decided 2026-09-12 (Artem). WebSocket was considered and ruled out. The `/occupancy` endpoint is unaffected and remains the source of truth for initial load; SSE carries deltas only.

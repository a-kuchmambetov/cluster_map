# Repository ↔ DB Contract (Vitalii ↔ Valentine)

Draft for review. Based on the project docs (`architecture/domain-model-and-data-flow`, `architecture/repository-structure`, `product/privacy-and-quality-requirements`). Goal — lock the **seam** between the API and the DB so we can work in parallel on mocks.

**Legend:** 🟢 fixed by docs/code · 🟡 proposal (needs Valentine's sign-off) · 🔴 blocked on access to the school's production database — schema and read-only credentials are not documented anywhere yet; owner to be confirmed with the team (Ping, as DevSecOps, is the likely candidate, but this is not stated in the docs).

---

## 1. Ownership boundary 🟡

The docs describe two **independent** data sources. Proposed split:

| Data | Source | Owner |
|---|---|---|
| **Layout config** (clusters, rows, places, numbers, gaps) | a file/config, loaded and validated by the API | **Vitalii** (API) |
| **Occupancy** (who sits where right now) | production DB, read-only | **Valentine** (`@repo/db`) |

Key consequence: **the cluster list and the layout come from the config (my area)**, and only **occupancy** is needed from the production DB. So the seam between us is narrow — essentially a single function.

---

## 2. What `@repo/db` (Valentine) provides to the API 🟡

Proposal: Valentine exposes a typed read-only function from `@repo/db`, and I call it from my `clusters.repository.ts`. The production SQL/Drizzle query itself lives inside `@repo/db`.

```ts
// @repo/db (written by Valentine)

// one occupancy record
export type OccupancyRow = {
  placeKey: string;              // 🔴 stable key matching the place id in the layout config
  intraName: string;             // always present
  displayName: string | null;    // may be absent
};

// return occupancy for a single cluster, read-only
export function getClusterOccupancy(
  clusterKey: string             // 🔴 how a cluster is identified in production (see §4)
): Promise<OccupancyRow[]>;
```

Guarantees this function must give (from the privacy/security rules 🟢):
- `SELECT` only — no writes/migrations against the production DB.
- Returns the **minimum fields**: `placeKey`, `intraName`, `displayName`. No email, no unnecessary personal data.
- If there is no occupancy — returns `[]` (empty array, not an error).
- If the production DB is unavailable — throws (I wrap it in `AppError` → the frontend gets a 500 and keeps the last map).
- Does not log full production DB records.

---

## 3. How I consume it (for clarity) 🟡

```ts
// clusters.repository.ts (my area) — calls Valentine's function
import { getClusterOccupancy } from "@repo/db";

// clusters.service.ts (my area) — merges config + occupancy
const config = loadClusterConfig(clusterNumber);          // from layout config (my area)
const occupancy = await getClusterOccupancy(config.key);  // from production DB (Valentine's area)
const map = mergeConfigWithOccupancy(config, occupancy);  // merge rules — §5
```

Until Valentine's function exists, I work against a **mock** with the same signature, so we don't block each other:
```ts
// temporary mock in place of @repo/db
async function getClusterOccupancy(_clusterKey: string): Promise<OccupancyRow[]> {
  return [{ placeKey: "c1r1p2", intraName: "jdoe", displayName: "John Doe" }];
}
```

---

## 4. Matching keys 🔴 (blocked on access to the school's production DB — owner unconfirmed)

The "production DB" here is the school's (42/HIVE) live database — not our local Postgres. We currently have neither read-only access to it nor its real schema. **Who owns/grants this access is not stated in the project docs** — Ping is DevSecOps and the likely person to ask, but this should be confirmed with the team rather than assumed.

The main unresolved question from the docs: "the meaning of *no matching occupancy record* and the stable keys used for a match must be confirmed against the production schema before implementation."

Needed (from whoever owns production DB access — confirm with Artem/Ping):
- **Read-only access/credentials** to the school's production database.
- **`placeKey`** — which production-record field identifies a specific place, and how it maps to the place `id` in our layout config. This determines how I assign `id`s in the config.
- **`clusterKey`** — how a cluster is identified in production (our `number`? some internal code?), so `getClusterOccupancy` knows what to request.
- The real **table/column names** of the production DB (for the query inside `@repo/db`).

Until then, `placeKey`/`clusterKey` are placeholders; this does not change the shape, only what fills them.

---

## 5. Merge rules (so we share the same semantics) 🟢

From the docs, the merge invariants (enforced by my `service`, but Valentine should know why the keys matter):
- A `gap` is never "free"/"occupied".
- A place with **no** matching occupancy record → `free` (proposal; see the open `unknown` question).
- A place with **one** valid matching record → `occupied`.
- **Duplicate** occupancy or occupancy for a **non-existent** place → a data-quality mismatch (goes into `warnings`), not a new place.
- Peer data is reduced to `intraName` + `displayName` **before** it leaves the API.

---

## 6. To confirm with Valentine
- [ ] The boundary in §1: config is my area, production occupancy is his.
- [ ] He exposes `getClusterOccupancy(...)` from `@repo/db` (rather than me writing the production SQL myself).
- [ ] The `OccupancyRow` type (`placeKey`, `intraName`, `displayName`) is the minimum sufficient set.
- [ ] Empty result = `[]`, DB unavailable = a thrown error.
- [ ] The local DB (`@repo/db` schema is currently empty) — is it needed at all for occupancy, or do we read production directly over a read-only connection?

---

## 7. Blocked — production DB access (owner to confirm)
- [ ] Who owns/grants access to the school's production DB (likely Ping, needs confirming — not documented).
- [ ] `placeKey` — the field and its link to the place `id` in the config.
- [ ] `clusterKey` — cluster identification in production.
- [ ] Real production DB table/column names + connection string (read-only).

---

## 8. Summary
The seam between us is **a single function**, `getClusterOccupancy`. Everything else (layout, merge, response shape) is my area and does not depend on Valentine. This lets me start on a mock immediately, lets him build the real query in parallel, and lets us swap the mock for `@repo/db` with no changes to `service`/`controller`. The only hard dependency is access to the school's production DB and its matching keys (§4) — owner to confirm with the team.
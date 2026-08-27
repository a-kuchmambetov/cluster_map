# Repository ↔ DB Contract (Vitalii ↔ Valentine)
 
Finalized per call with Valentine on 2026-08-06. Based on the project docs (`architecture/domain-model-and-data-flow`, `architecture/repository-structure`, `product/privacy-and-quality-requirements`). Goal — lock the **seam** between the API and the DB so we can work in parallel on mocks.
 
**Legend:** 🟢 fixed by docs/code · 🔴 blocked on access to the school's production database — schema and read-only credentials are not documented anywhere yet; owner to be confirmed with the team (Ping, as DevSecOps, is the likely candidate, but this is not stated in the docs).
 
---
 
## 1. Ownership boundary 🟢 (confirmed with Valentine)
 
The docs describe two **independent** data sources:
 
| Data | Source | Owner |
|---|---|---|
| **Layout config** (clusters, rows, places, numbers, gaps) | a file/config, loaded and validated by the API | **Vitalii** (API) |
| **Occupancy** (who sits where right now) | production DB, read-only | **Valentine** (`@repo/db`) |
 
Key consequence: **the cluster list and the layout come from the config (my area)**, and only **occupancy** is needed from the production DB. So the seam between us is narrow — essentially a single function.
 
---
 
## 2. What `@repo/db` (Valentine) provides to the API 🟢 (confirmed with Valentine)
 
Valentine exposes a typed read-only function from `@repo/db`, and I call it from my `clusters.repository.ts`. The production SQL/Drizzle query itself lives inside `@repo/db`.
 
```ts
// @repo/db (written by Valentine)
 
// one occupancy record — scoped to a single cluster already,
// so no clusterKey needed here
export type OccupancyRow = {
  row: number;                  // row number within the cluster
  place: number;                // place number within the row
  intraName: string | null;     // Hive login — NOT always present (guest accounts may lack it)
  displayName: string | null;   // real name — also may be absent
  photo: string | null;         // avatar/photo URL, or null (default photo used by frontend)
};
 
// return occupancy for a single cluster, read-only
export function getClusterOccupancy(
  clusterKey: string // 🔴 how a cluster is identified in production (see §4)
): Promise<OccupancyRow[]>;
```
 
**Why `intraName`/`displayName` are both optional:** the project has two account types — users pulled from Hive (via Hive API, have an intra login) and guests who register directly on the site (may only have a display name, no intra login). Neither field is guaranteed.
 
**Why no `email`:** discussed and agreed — the cluster map only needs enough to identify who's sitting where, matching what 42/Hive's own cluster map shows (photo + login). Email is unnecessary personal data per the privacy rules and was explicitly dropped.
 
**Both name fields are passed through raw:** Valentine returns whatever fields are available; the API forwards `intraName`, `displayName`, and `photo` unchanged. No priority or fallback logic is applied server-side — presentation is the frontend's decision (confirmed by Maxim, 2026-08-26).
 
Guarantees this function must give (from the privacy/security rules 🟢):
- `SELECT` only — no writes/migrations against the production DB.
- Returns the **minimum fields**: `row`, `place`, `intraName`, `displayName`, `photo`. No email, no unnecessary personal data.
- If there is no occupancy — returns `[]` (empty array, not an error). This is a **normal result**, not a special case.
- If the production DB is unavailable — **throws** (I wrap it in `AppError` → the frontend gets a 500 and keeps the last map). This is the **only** signal of failure; there is no separate "check DB health" function.
- Only **one function** is needed from Valentine for the entire project: `getClusterOccupancy`.
- Does not log full production DB records.
---
 
## 3. How I consume it (for clarity) 🟢
 
```ts
// clusters.repository.ts (my area) — calls Valentine's function
import { getClusterOccupancy } from "@repo/db";
 
// clusters.service.ts (my area) — merges config + occupancy
const config = loadClusterConfig(clusterNumber);        // from layout config (my area)
const occupancy = await getClusterOccupancy(config.key); // from production DB (Valentine's area)
const map = mergeConfigWithOccupancy(config, occupancy);  // merge rules — §5
```
 
Until Valentine's function exists, I work against a **mock** with the same signature, so we don't block each other:
```ts
// temporary mock in place of @repo/db
async function getClusterOccupancy(_clusterKey: string): Promise<OccupancyRow[]> {
  return [{ row: 1, place: 2, intraName: "jdoe", displayName: "John Doe", photo: null }];
}
```
 
---
 
## 4. Matching keys 🔴 (blocked on access to the school's production DB — owner unconfirmed)
 
The "production DB" here is the school's (42/HIVE) live database — not our local Postgres. We currently have neither read-only access to it nor its real schema. **Who owns/grants this access is not stated in the project docs** — Ping is DevSecOps and the likely person to ask, but this should be confirmed with the team rather than assumed.
 
Needed (from whoever owns production DB access — confirm with Artem/Ping):
- **Read-only access/credentials** to the school's production database.
- How a production occupancy record maps to `row`/`place` in our layout config (previously drafted as a single `placeKey` — replaced with the two separate numeric fields per §2; this section still needs the real production field mapping).
- **`clusterKey`** — how a cluster is identified in production (our `number`? some internal code?), so `getClusterOccupancy` knows what to request.
- The real **table/column names** of the production DB (for the query inside `@repo/db`).
Until then, `clusterKey` and the row/place mapping are placeholders; this does not change the shape, only what fills them.
 
---
 
## 5. Merge rules (so we share the same semantics) 🟢
 
From the docs, the merge invariants (enforced by my `service`, but Valentine should know why the keys matter):
- A `gap` is never "free"/"occupied".
- A place with **no** matching occupancy record → `free`.
- A place with **one** valid matching record → `occupied`.
- **Duplicate** occupancy or occupancy for a **non-existent** place → a data-quality mismatch (goes into `warnings`), not a new place.
- Peer data is forwarded as `intraName` + `displayName` + `photo` unchanged from the occupancy source — no priority or fallback logic applied.
---
 
## 6. Confirmed with Valentine ✅ (all closed 2026-08-06)
 
- [x] The boundary in §1: config is my area, production occupancy is his.
- [x] He exposes `getClusterOccupancy(...)` from `@repo/db` (rather than me writing the production SQL myself).
- [x] The `OccupancyRow` type (`row`, `place`, `intraName`, `displayName`, `photo`) is the minimum sufficient set — replaces the earlier `placeKey` proposal.
- [x] Empty result = `[]` (normal, not an error), DB unavailable = a thrown error. Only one function needed.
- [x] No local Postgres needed for occupancy — read production directly over a read-only connection. `@repo/db`'s local Postgres schema (if any) is unrelated to occupancy.
---
 
## 7. Blocked — production DB access (owner to confirm)
- [ ] Who owns/grants access to the school's production DB (likely Ping, needs confirming — not documented).
- [ ] Real production field(s) that map to `row`/`place` in the config.
- [ ] `clusterKey` — cluster identification in production.
- [ ] Real production DB table/column names + connection string (read-only).
---
 
## 8. Summary
The seam between us is **a single function**, `getClusterOccupancy`. Everything else (layout, merge, response shape) is my area and does not depend on Valentine. This lets me start on a mock immediately, lets him build the real query in parallel, and lets us swap the mock for `@repo/db` with no changes to `service`/`controller`. The only hard dependency is access to the school's production DB and its matching keys (§4) — owner to confirm with the team.
 
---
 
## 9. Out of scope for this contract
 
User account creation/approval/blocking and authentication (subject requirement: public API with API key, rate limiting, 5+ write endpoints, via Better-Auth) is **entirely Artem's responsibility**, tracked separately, and does not touch this read-only occupancy contract or Valentine's `@repo/db` function.
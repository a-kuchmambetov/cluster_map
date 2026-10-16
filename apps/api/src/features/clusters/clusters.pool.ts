import { getClusterOccupancy } from "./clusters.repository";
import type { OccupiedEntry } from "./clusters.types";

export const POLL_INTERVAL_MS = 30_000;

export type EmitFn = (event: string, data: string) => void;

export type OccupancyDelta = {
  occupied: OccupiedEntry[];
  freed: { row: number; place: number }[];
};

function entryKey(e: OccupiedEntry): string {
  return `${e.row}:${e.place}`;
}

function peersEqual(a: OccupiedEntry, b: OccupiedEntry): boolean {
  return (
    a.peer.intraName === b.peer.intraName &&
    a.peer.displayName === b.peer.displayName &&
    a.peer.photo === b.peer.photo
  );
}

// Pure function — all pool and SSE logic depends on this.
// occupied[]: newly occupied places + places whose peer data changed.
// freed[]:    places that were occupied and are now free.
export function diffSnapshots(
  prev: OccupiedEntry[],
  next: OccupiedEntry[],
): OccupancyDelta {
  const prevMap = new Map(prev.map((e) => [entryKey(e), e]));
  const nextMap = new Map(next.map((e) => [entryKey(e), e]));

  const occupied: OccupiedEntry[] = [];
  for (const [k, nextEntry] of nextMap) {
    const prevEntry = prevMap.get(k);
    if (!prevEntry || !peersEqual(prevEntry, nextEntry)) {
      occupied.push(nextEntry);
    }
  }

  const freed: { row: number; place: number }[] = [];
  for (const [k, prevEntry] of prevMap) {
    if (!nextMap.has(k)) {
      freed.push({ row: prevEntry.row, place: prevEntry.place });
    }
  }

  return { occupied, freed };
}

// Per-cluster poller state, keyed by cluster DB id (e.g. "c1").
//
// The poller is the only writer of `baseline`: it is the occupancy that every
// ready subscriber has been brought up to date with, either through the
// `occupancy-snapshot` it received on connect or through the deltas emitted
// since. REST reads never touch it, so one client's page load cannot swallow
// a change another client has not seen yet.
//
// A subscriber is "pending" until it has received a full snapshot. Snapshots
// and deltas are emitted synchronously from in-memory state, so a subscriber
// can never receive a snapshot that is older than a delta it already got.
type ClusterPoller = {
  subscribers: Map<EmitFn, { ready: boolean }>;
  baseline: OccupiedEntry[] | undefined;
  baselineAt: string | null;
  // Set after a failed poll. The next successful poll sends every subscriber
  // a full snapshot so clients can clear their stale state even when the
  // occupancy did not change during the outage.
  failed: boolean;
  polling: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
};

const pollers = new Map<string, ClusterPoller>();

function snapshotData(poller: ClusterPoller): string {
  return JSON.stringify({
    occupied: poller.baseline ?? [],
    lastUpdated: poller.baselineAt,
  });
}

async function poll(clusterId: string, poller: ClusterPoller): Promise<void> {
  let nextEntries: OccupiedEntry[];
  try {
    const rows = await getClusterOccupancy(clusterId);
    nextEntries = rows.map((r) => ({
      row: r.row,
      place: r.place,
      peer: {
        intraName: r.intraName,
        displayName: r.displayName,
        photo: r.photo,
      },
    }));
  } catch {
    poller.failed = true;
    const data = JSON.stringify({
      code: "DB_UNAVAILABLE",
      message: "Occupancy data temporarily unavailable",
    });
    for (const emit of poller.subscribers.keys()) emit("error", data);
    return;
  }

  const prev = poller.baseline;
  const resync = poller.failed || prev === undefined;
  const delta = diffSnapshots(prev ?? [], nextEntries);
  poller.baseline = nextEntries;
  poller.baselineAt = new Date().toISOString();
  poller.failed = false;

  const snapshot = snapshotData(poller);
  const deltaData =
    delta.occupied.length > 0 || delta.freed.length > 0
      ? JSON.stringify(delta)
      : null;
  for (const [emit, state] of poller.subscribers) {
    if (resync || !state.ready) {
      state.ready = true;
      emit("occupancy-snapshot", snapshot);
    } else if (deltaData !== null) {
      emit("occupancy-delta", deltaData);
    }
  }
}

// Runs one poll now, then chains the next one POLL_INTERVAL_MS after it
// finishes, so two polls for the same poller can never run concurrently.
// A poller that was removed (last subscriber left) is never rescheduled; an
// in-flight poll for it only reaches its own, now empty, subscriber map.
function runPoll(clusterId: string, poller: ClusterPoller): void {
  poller.polling = true;
  poll(clusterId, poller)
    .catch(() => {
      // poll() handles its own errors internally (DB_UNAVAILABLE event);
      // this catch prevents unhandled-rejection noise.
    })
    .finally(() => {
      poller.polling = false;
      if (pollers.get(clusterId) === poller) {
        poller.timer = setTimeout(() => {
          poller.timer = undefined;
          runPoll(clusterId, poller);
        }, POLL_INTERVAL_MS);
      }
    });
}

// Returns an unsubscribe function. The caller (SSE handler) must call it when
// the client disconnects.
//
// Every new subscription (including a client reconnect) receives a full
// `occupancy-snapshot` before any delta: immediately when a baseline exists,
// otherwise from the result of the next poll, which is started right away
// unless one is already in flight.
export function subscribe(clusterId: string, emit: EmitFn): () => void {
  let poller = pollers.get(clusterId);
  if (!poller) {
    poller = {
      subscribers: new Map(),
      baseline: undefined,
      baselineAt: null,
      failed: false,
      polling: false,
      timer: undefined,
    };
    pollers.set(clusterId, poller);
  }

  if (poller.baseline !== undefined && !poller.failed) {
    poller.subscribers.set(emit, { ready: true });
    emit("occupancy-snapshot", snapshotData(poller));
  } else {
    poller.subscribers.set(emit, { ready: false });
    if (!poller.polling) {
      clearTimeout(poller.timer);
      poller.timer = undefined;
      runPoll(clusterId, poller);
    }
  }

  const owner = poller;
  return () => unsubscribe(clusterId, owner, emit);
}

function unsubscribe(
  clusterId: string,
  poller: ClusterPoller,
  emit: EmitFn,
): void {
  poller.subscribers.delete(emit);

  if (poller.subscribers.size === 0 && pollers.get(clusterId) === poller) {
    clearTimeout(poller.timer);
    poller.timer = undefined;
    // The baseline is dropped with the poller: nobody keeps it current while
    // the cluster has no subscribers, so the next subscriber starts cold.
    pollers.delete(clusterId);
  }
}

// For tests only — resets all module-level state so pool tests are isolated.
export function resetPool(): void {
  for (const poller of pollers.values()) clearTimeout(poller.timer);
  pollers.clear();
}

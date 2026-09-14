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
export function diffSnapshots(prev: OccupiedEntry[], next: OccupiedEntry[]): OccupancyDelta {
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

// Process-level shared snapshot, keyed by cluster DB id (e.g. "c1").
// Written by /occupancy on every call; read by the poller as its initial state.
// This is the mechanism that closes the cold-start window: the client always
// calls /occupancy before opening SSE, so by the time the first poll runs the
// snapshot already reflects what the client has seen.
const sharedSnapshots = new Map<string, OccupiedEntry[]>();

// Pool state — keyed by cluster DB id.
const subscribers = new Map<string, Set<EmitFn>>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

// Called by /occupancy after every successful fetch.
export function writeSharedSnapshot(clusterId: string, entries: OccupiedEntry[]): void {
    sharedSnapshots.set(clusterId, entries);
}

// Exposed for testing so tests can verify the snapshot survives unsubscribe.
export function getSharedSnapshot(clusterId: string): OccupiedEntry[] | undefined {
    return sharedSnapshots.get(clusterId);
}

async function poll(clusterId: string): Promise<void> {
    const subs = subscribers.get(clusterId);
    if (!subs || subs.size === 0) return;

    let nextEntries: OccupiedEntry[];
    try {
        const rows = await getClusterOccupancy(clusterId);
        nextEntries = rows.map((r) => ({
            row: r.row,
            place: r.place,
            peer: { intraName: r.intraName, displayName: r.displayName, photo: r.photo },
        }));
    } catch {
        const data = JSON.stringify({
            code: "DB_UNAVAILABLE",
            message: "Occupancy data temporarily unavailable",
        });
        for (const emit of subs) emit("error", data);
        return;
    }

    const prev = sharedSnapshots.get(clusterId) ?? [];
    const delta = diffSnapshots(prev, nextEntries);

    // Always overwrite the shared snapshot — /occupancy reads it too.
    sharedSnapshots.set(clusterId, nextEntries);

    if (delta.occupied.length > 0 || delta.freed.length > 0) {
        const data = JSON.stringify(delta);
        for (const emit of subs) emit("occupancy-delta", data);
    }
}

// Returns an unsubscribe function. The caller (SSE handler) must call it when
// the client disconnects.
export function subscribe(clusterId: string, emit: EmitFn): () => void {
    if (!subscribers.has(clusterId)) {
        subscribers.set(clusterId, new Set());
    }
    subscribers.get(clusterId)!.add(emit);

    if (!timers.has(clusterId)) {
        const timer = setInterval(() => {
            poll(clusterId).catch(() => {
                // poll() handles its own errors internally (DB_UNAVAILABLE event);
                // this catch prevents unhandled-rejection noise from the interval.
            });
        }, POLL_INTERVAL_MS);
        timers.set(clusterId, timer);
    }

    return () => unsubscribe(clusterId, emit);
}

function unsubscribe(clusterId: string, emit: EmitFn): void {
    const subs = subscribers.get(clusterId);
    if (!subs) return;

    subs.delete(emit);

    if (subs.size === 0) {
        const timer = timers.get(clusterId);
        if (timer !== undefined) {
            clearInterval(timer);
            timers.delete(clusterId);
        }
        subscribers.delete(clusterId);
        // sharedSnapshots entry is intentionally kept: the snapshot is
        // process-level state, not owned by the poller. The next client
        // to call /occupancy writes a fresh snapshot; the SSE seed then
        // has something to diff against rather than starting cold.
    }
}

// For tests only — resets all module-level state so pool tests are isolated.
export function resetPool(): void {
    for (const timer of timers.values()) clearInterval(timer);
    timers.clear();
    subscribers.clear();
    sharedSnapshots.clear();
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    diffSnapshots,
    getSharedSnapshot,
    resetPool,
    subscribe,
    writeSharedSnapshot,
} from "./clusters.pool";
import type { OccupiedEntry } from "./clusters.types";

// The pool calls getClusterOccupancy from the repository.
// Mock the entire repository module so no DB connection is required.
const getClusterOccupancyMock = vi.fn();
vi.mock("./clusters.repository", () => ({
    getClusterOccupancy: (...args: unknown[]) => getClusterOccupancyMock(...args),
}));

// ---------------------------------------------------------------------------
// diffSnapshots
// ---------------------------------------------------------------------------

const entry = (row: number, place: number, overrides?: Partial<OccupiedEntry["peer"]>): OccupiedEntry => ({
    row,
    place,
    peer: { intraName: null, displayName: null, photo: null, ...overrides },
});

describe("diffSnapshots", () => {
    it("reports a newly occupied place in occupied[]", () => {
        const delta = diffSnapshots([], [entry(1, 2, { intraName: "jdoe" })]);
        expect(delta.occupied).toHaveLength(1);
        expect(delta.occupied[0]).toMatchObject({ row: 1, place: 2 });
        expect(delta.freed).toHaveLength(0);
    });

    it("reports a vacated place in freed[]", () => {
        const delta = diffSnapshots([entry(1, 2)], []);
        expect(delta.freed).toHaveLength(1);
        expect(delta.freed[0]).toEqual({ row: 1, place: 2 });
        expect(delta.occupied).toHaveLength(0);
    });

    it("reports a peer data change in occupied[] (not in freed[])", () => {
        const prev = [entry(1, 2, { intraName: "alice" })];
        const next = [entry(1, 2, { intraName: "bob" })];
        const delta = diffSnapshots(prev, next);
        expect(delta.occupied).toHaveLength(1);
        expect(delta.occupied[0].peer.intraName).toBe("bob");
        expect(delta.freed).toHaveLength(0);
    });

    it("emits nothing when nothing changed", () => {
        const snapshot = [entry(1, 2, { intraName: "jdoe" }), entry(1, 5)];
        const delta = diffSnapshots(snapshot, snapshot);
        expect(delta.occupied).toHaveLength(0);
        expect(delta.freed).toHaveLength(0);
    });

    it("handles simultaneous occupy and free in one diff", () => {
        const prev = [entry(1, 1), entry(1, 2)];
        const next = [entry(1, 2), entry(1, 3)];
        const delta = diffSnapshots(prev, next);
        expect(delta.freed).toEqual([{ row: 1, place: 1 }]);
        expect(delta.occupied).toHaveLength(1);
        expect(delta.occupied[0]).toMatchObject({ row: 1, place: 3 });
    });
});

// ---------------------------------------------------------------------------
// subscribe / pool behaviour
// ---------------------------------------------------------------------------

describe("subscribe", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetPool();
        getClusterOccupancyMock.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
        resetPool();
    });

    it("starts a poll timer on the first subscriber and fires it after 30 s", async () => {
        getClusterOccupancyMock.mockResolvedValue([]);
        const emit = vi.fn();

        subscribe("c1", emit);
        expect(getClusterOccupancyMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(30_000);
        expect(getClusterOccupancyMock).toHaveBeenCalledWith("c1");
    });

    it("does not start a second timer for a second subscriber on the same cluster", async () => {
        getClusterOccupancyMock.mockResolvedValue([]);
        subscribe("c1", vi.fn());
        subscribe("c1", vi.fn());

        await vi.advanceTimersByTimeAsync(30_000);
        // One poll per interval regardless of subscriber count.
        expect(getClusterOccupancyMock).toHaveBeenCalledTimes(1);
    });

    it("emits occupancy-delta to all subscribers when something changed", async () => {
        getClusterOccupancyMock.mockResolvedValue([
            { row: 1, place: 2, intraName: "jdoe", displayName: "John Doe", photo: null },
        ]);

        const emit1 = vi.fn();
        const emit2 = vi.fn();
        subscribe("c1", emit1);
        subscribe("c1", emit2);

        await vi.advanceTimersByTimeAsync(30_000);

        for (const emit of [emit1, emit2]) {
            expect(emit).toHaveBeenCalledOnce();
            const [event, data] = emit.mock.calls[0];
            expect(event).toBe("occupancy-delta");
            const parsed = JSON.parse(data as string);
            expect(parsed.occupied).toHaveLength(1);
            expect(parsed.occupied[0]).toMatchObject({ row: 1, place: 2 });
        }
    });

    it("emits nothing when the snapshot is unchanged", async () => {
        // Pre-populate the shared snapshot with the same data the DB will return.
        writeSharedSnapshot("c1", [entry(1, 2)]);
        getClusterOccupancyMock.mockResolvedValue([
            { row: 1, place: 2, intraName: null, displayName: null, photo: null },
        ]);

        const emit = vi.fn();
        subscribe("c1", emit);
        await vi.advanceTimersByTimeAsync(30_000);

        expect(emit).not.toHaveBeenCalled();
    });

    it("emits an error event when the DB call fails, then keeps the connection open", async () => {
        getClusterOccupancyMock.mockRejectedValue(new Error("connection refused"));

        const emit = vi.fn();
        subscribe("c1", emit);
        await vi.advanceTimersByTimeAsync(30_000);

        expect(emit).toHaveBeenCalledOnce();
        const [event, data] = emit.mock.calls[0];
        expect(event).toBe("error");
        expect(JSON.parse(data as string)).toEqual({
            code: "DB_UNAVAILABLE",
            message: "Occupancy data temporarily unavailable",
        });

        // Connection is still live: a second poll goes through.
        getClusterOccupancyMock.mockResolvedValue([]);
        await vi.advanceTimersByTimeAsync(30_000);
        // Nothing changed (empty → empty), so no occupancy-delta is emitted.
        // emit was only called once (the error event above).
        expect(emit).toHaveBeenCalledTimes(1);
        expect(getClusterOccupancyMock).toHaveBeenCalledTimes(2);
    });

    it("stops the timer when the last subscriber leaves but keeps the shared snapshot", async () => {
        writeSharedSnapshot("c1", [entry(1, 2)]);
        getClusterOccupancyMock.mockResolvedValue([]);

        const emit = vi.fn();
        const unsubscribe = subscribe("c1", emit);

        // Trigger one poll so the snapshot gets overwritten to [].
        await vi.advanceTimersByTimeAsync(30_000);
        expect(getClusterOccupancyMock).toHaveBeenCalledTimes(1);

        unsubscribe();

        // After unsubscribe the timer is gone: advancing time triggers no more polls.
        getClusterOccupancyMock.mockClear();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(getClusterOccupancyMock).not.toHaveBeenCalled();

        // Snapshot is still there (the pool wrote [] from the first poll).
        expect(getSharedSnapshot("c1")).toBeDefined();
    });

    it("seeds from the shared snapshot so the first poll diffs against what /occupancy returned", async () => {
        // Simulate /occupancy having written a snapshot.
        writeSharedSnapshot("c1", [entry(1, 2, { intraName: "jdoe" })]);

        // DB returns the same state → no delta expected.
        getClusterOccupancyMock.mockResolvedValue([
            { row: 1, place: 2, intraName: "jdoe", displayName: null, photo: null },
        ]);

        const emit = vi.fn();
        subscribe("c1", emit);
        await vi.advanceTimersByTimeAsync(30_000);

        expect(emit).not.toHaveBeenCalled();
    });
});

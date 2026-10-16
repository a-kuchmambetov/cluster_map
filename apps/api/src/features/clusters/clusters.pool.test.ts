import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffSnapshots, resetPool, subscribe } from "./clusters.pool";
import { getClusterOccupancyData } from "./clusters.service";
import type { OccupancyRow, OccupiedEntry } from "./clusters.types";

// The pool calls getClusterOccupancy from the repository.
// Mock the entire repository module so no DB connection is required.
const getClusterOccupancyMock = vi.fn();
vi.mock("./clusters.repository", () => ({
  getClusterOccupancy: (...args: unknown[]) => getClusterOccupancyMock(...args),
}));

// ---------------------------------------------------------------------------
// diffSnapshots
// ---------------------------------------------------------------------------

const entry = (
  row: number,
  place: number,
  overrides?: Partial<OccupiedEntry["peer"]>,
): OccupiedEntry => ({
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

const row = (place: number, intraName: string | null = null): OccupancyRow => ({
  row: 1,
  place,
  intraName,
  displayName: null,
  photo: null,
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Records events in arrival order with parsed payloads.
const recorder = () => {
  const events: { event: string; data: { [key: string]: unknown } }[] = [];
  const emit = vi.fn((event: string, data: string) => {
    events.push({ event, data: JSON.parse(data) });
  });
  return { emit, events };
};

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

  it("polls immediately for the first subscriber and sends a full snapshot", async () => {
    getClusterOccupancyMock.mockResolvedValue([row(2, "jdoe")]);
    const { emit, events } = recorder();

    subscribe("c1", emit);
    expect(getClusterOccupancyMock).toHaveBeenCalledWith("c1");
    await vi.advanceTimersByTimeAsync(0);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("occupancy-snapshot");
    expect(events[0].data.occupied).toEqual([
      entry(1, 2, { intraName: "jdoe" }),
    ]);
    expect(typeof events[0].data.lastUpdated).toBe("string");

    // Afterwards the poll chain runs every 30 s.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(2);
  });

  it("sends an empty snapshot for an empty cluster and serves later subscribers from memory", async () => {
    getClusterOccupancyMock.mockResolvedValue([]);
    const first = recorder();
    subscribe("c1", first.emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(first.events).toEqual([
      {
        event: "occupancy-snapshot",
        data: { occupied: [], lastUpdated: expect.any(String) },
      },
    ]);

    const second = recorder();
    subscribe("c1", second.emit);
    // Delivered synchronously from the baseline — no extra DB query.
    expect(second.events).toEqual(first.events);
    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(1);
  });

  it("polls once per interval regardless of subscriber count", async () => {
    getClusterOccupancyMock.mockResolvedValue([]);
    subscribe("c1", vi.fn());
    subscribe("c1", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(2);
  });

  it("emits occupancy-delta to all ready subscribers when something changed", async () => {
    getClusterOccupancyMock.mockResolvedValue([]);
    const a = recorder();
    const b = recorder();
    subscribe("c1", a.emit);
    subscribe("c1", b.emit);
    await vi.advanceTimersByTimeAsync(0);

    getClusterOccupancyMock.mockResolvedValue([row(2, "jdoe")]);
    await vi.advanceTimersByTimeAsync(30_000);

    for (const { events } of [a, b]) {
      expect(events.map((e) => e.event)).toEqual([
        "occupancy-snapshot",
        "occupancy-delta",
      ]);
      expect(events[1].data).toEqual({
        occupied: [entry(1, 2, { intraName: "jdoe" })],
        freed: [],
      });
    }
  });

  it("emits nothing after the snapshot when occupancy is unchanged", async () => {
    getClusterOccupancyMock.mockResolvedValue([row(2)]);
    const { emit } = recorder();
    subscribe("c1", emit);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledOnce();
  });

  it("does not let a REST /occupancy read swallow a change for an existing subscriber", async () => {
    // Client B is connected and has seen S0 (place 2 free).
    getClusterOccupancyMock.mockResolvedValue([]);
    const b = recorder();
    subscribe("c1", b.emit);
    await vi.advanceTimersByTimeAsync(0);

    // DB changes to S1, then client A loads the page via REST.
    getClusterOccupancyMock.mockResolvedValue([row(2, "jdoe")]);
    const rest = await getClusterOccupancyData(1);
    expect(rest.occupied).toEqual([entry(1, 2, { intraName: "jdoe" })]);

    // The next poll must still deliver S0 → S1 to B.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(b.events.at(-1)).toEqual({
      event: "occupancy-delta",
      data: { occupied: [entry(1, 2, { intraName: "jdoe" })], freed: [] },
    });
  });

  it("does not reset the baseline of existing subscribers when a new one joins", async () => {
    getClusterOccupancyMock.mockResolvedValue([]);
    const b = recorder();
    subscribe("c1", b.emit);
    await vi.advanceTimersByTimeAsync(0);

    // DB changes, then A connects before the next poll.
    getClusterOccupancyMock.mockResolvedValue([row(2, "jdoe")]);
    const a = recorder();
    subscribe("c1", a.emit);
    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    const delta = {
      event: "occupancy-delta",
      data: { occupied: [entry(1, 2, { intraName: "jdoe" })], freed: [] },
    };
    expect(b.events.at(-1)).toEqual(delta);
    // A's snapshot was the poller baseline, so it receives the same delta.
    expect(a.events.map((e) => e.event)).toEqual([
      "occupancy-snapshot",
      "occupancy-delta",
    ]);
    expect(a.events[0].data.occupied).toEqual([]);
    expect(a.events[1]).toEqual(delta);
  });

  it("serves a subscriber that joins during the cold-start poll from that poll, without a concurrent query", async () => {
    const pending = deferred<OccupancyRow[]>();
    getClusterOccupancyMock.mockReturnValueOnce(pending.promise);
    const a = recorder();
    const b = recorder();
    subscribe("c1", a.emit);
    subscribe("c1", b.emit);
    expect(getClusterOccupancyMock).toHaveBeenCalledOnce();

    pending.resolve([row(3)]);
    await vi.advanceTimersByTimeAsync(0);
    for (const { events } of [a, b]) {
      expect(events).toEqual([
        {
          event: "occupancy-snapshot",
          data: { occupied: [entry(1, 3)], lastUpdated: expect.any(String) },
        },
      ]);
    }
  });

  it("sends the current snapshot before the delta of a poll already in flight", async () => {
    getClusterOccupancyMock.mockResolvedValue([]);
    subscribe("c1", vi.fn());
    await vi.advanceTimersByTimeAsync(0);

    const pending = deferred<OccupancyRow[]>();
    getClusterOccupancyMock.mockReturnValueOnce(pending.promise);
    await vi.advanceTimersByTimeAsync(30_000);

    // Joins while the second poll is waiting on the DB.
    const late = recorder();
    subscribe("c1", late.emit);
    pending.resolve([row(4)]);
    await vi.advanceTimersByTimeAsync(0);

    expect(late.events).toEqual([
      {
        event: "occupancy-snapshot",
        data: { occupied: [], lastUpdated: expect.any(String) },
      },
      {
        event: "occupancy-delta",
        data: { occupied: [entry(1, 4)], freed: [] },
      },
    ]);
  });

  it("emits DB_UNAVAILABLE, keeps polling and resyncs everyone with a snapshot on recovery", async () => {
    getClusterOccupancyMock.mockResolvedValue([row(2)]);
    const ready = recorder();
    subscribe("c1", ready.emit);
    await vi.advanceTimersByTimeAsync(0);

    getClusterOccupancyMock.mockRejectedValue(new Error("connection refused"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ready.events.at(-1)).toEqual({
      event: "error",
      data: {
        code: "DB_UNAVAILABLE",
        message: "Occupancy data temporarily unavailable",
      },
    });

    // A subscriber joining during the outage does not get the stale baseline;
    // it triggers its own poll, which also fails.
    const joined = recorder();
    subscribe("c1", joined.emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(joined.events.map((e) => e.event)).toEqual(["error"]);

    // DB recovers with unchanged data: both get a snapshot so stale clears.
    getClusterOccupancyMock.mockResolvedValue([row(2)]);
    await vi.advanceTimersByTimeAsync(30_000);
    for (const { events } of [ready, joined]) {
      expect(events.at(-1)).toEqual({
        event: "occupancy-snapshot",
        data: { occupied: [entry(1, 2)], lastUpdated: expect.any(String) },
      });
    }
  });

  it("stops polling when the last subscriber leaves and resyncs a reconnecting client", async () => {
    getClusterOccupancyMock.mockResolvedValue([row(2)]);
    const first = recorder();
    const unsubscribe = subscribe("c1", first.emit);
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();

    getClusterOccupancyMock.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getClusterOccupancyMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    // Changes made while disconnected are repaired by the reconnect snapshot.
    getClusterOccupancyMock.mockResolvedValue([row(5)]);
    const reconnected = recorder();
    subscribe("c1", reconnected.emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(reconnected.events).toEqual([
      {
        event: "occupancy-snapshot",
        data: { occupied: [entry(1, 5)], lastUpdated: expect.any(String) },
      },
    ]);
    expect(first.events).toHaveLength(1);
  });

  it("drops the result of a poll in flight when the last subscriber left before it resolved", async () => {
    const stale = deferred<OccupancyRow[]>();
    getClusterOccupancyMock.mockReturnValueOnce(stale.promise);
    const first = recorder();
    subscribe("c1", first.emit)();

    const fresh = deferred<OccupancyRow[]>();
    getClusterOccupancyMock.mockReturnValueOnce(fresh.promise);
    const second = recorder();
    subscribe("c1", second.emit);
    expect(getClusterOccupancyMock).toHaveBeenCalledTimes(2);

    stale.resolve([row(1)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(first.events).toEqual([]);
    expect(second.events).toEqual([]);

    fresh.resolve([row(7)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(second.events).toEqual([
      {
        event: "occupancy-snapshot",
        data: { occupied: [entry(1, 7)], lastUpdated: expect.any(String) },
      },
    ]);
    // Only the live poller keeps a timer chain.
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops sending events to a subscriber after it unsubscribes", async () => {
    getClusterOccupancyMock.mockResolvedValue([]);
    const stays = recorder();
    const leaves = recorder();
    subscribe("c1", stays.emit);
    const unsubscribe = subscribe("c1", leaves.emit);
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();
    unsubscribe();

    getClusterOccupancyMock.mockResolvedValue([row(2)]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(leaves.events.map((e) => e.event)).toEqual(["occupancy-snapshot"]);
    expect(stays.events.map((e) => e.event)).toEqual([
      "occupancy-snapshot",
      "occupancy-delta",
    ]);
  });
});

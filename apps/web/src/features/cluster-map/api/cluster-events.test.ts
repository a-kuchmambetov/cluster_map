import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeClusterEvents } from "./cluster-events";

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  close = vi.fn();
  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }
}

describe("cluster event recovery", () => {
  let unsubscribe: (() => void) | undefined;
  const onSnapshot = vi.fn();
  const onDelta = vi.fn();
  const onStale = vi.fn();
  const subscribe = (enabled = true) => {
    unsubscribe = subscribeClusterEvents({
      clusterNumber: 2,
      enabled,
      onSnapshot,
      onDelta,
      onStale,
    });
  };
  const snapshot = (occupied: unknown[] = []) =>
    new MessageEvent("occupancy-snapshot", {
      data: JSON.stringify({ occupied, lastUpdated: "2026-01-01T00:00:00Z" }),
    });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    FakeEventSource.instances = [];
  });
  afterEach(() => {
    unsubscribe?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits for the initial snapshot before opening a stream", () => {
    subscribe(false);
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("passes stream snapshots and deltas through in order", () => {
    subscribe();
    const source = FakeEventSource.instances[0];
    const delta = { occupied: [], freed: [{ row: 1, place: 2 }] };
    source.dispatchEvent(snapshot([{ row: 1, place: 2 }]));
    source.dispatchEvent(
      new MessageEvent("occupancy-delta", { data: JSON.stringify(delta) }),
    );
    expect(onSnapshot).toHaveBeenCalledWith({
      occupied: [{ row: 1, place: 2 }],
      lastUpdated: "2026-01-01T00:00:00Z",
    });
    expect(onDelta).toHaveBeenCalledWith(delta);
    expect(onSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      onDelta.mock.invocationCallOrder[0],
    );
  });

  it("keeps the stream open during DB failure and waits for the recovery snapshot", async () => {
    subscribe();
    const source = FakeEventSource.instances[0];
    source.dispatchEvent(
      new MessageEvent("error", {
        data: JSON.stringify({ code: "DB_UNAVAILABLE" }),
      }),
    );
    expect(onStale).toHaveBeenCalledOnce();
    expect(source.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    source.dispatchEvent(snapshot());
    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("reopens the stream after transport failure and resyncs from its snapshot", async () => {
    subscribe();
    const source = FakeEventSource.instances[0];
    source.dispatchEvent(new Event("error"));
    expect(source.close).toHaveBeenCalledOnce();
    expect(onStale).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(FakeEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeEventSource.instances).toHaveLength(2);
    const reopened = FakeEventSource.instances[1];
    expect(reopened.url).toBe("/api/clusters/2/events");
    reopened.dispatchEvent(snapshot([{ row: 3, place: 4 }]));
    expect(onSnapshot).toHaveBeenCalledWith({
      occupied: [{ row: 3, place: 4 }],
      lastUpdated: "2026-01-01T00:00:00Z",
    });
  });

  it("keeps retrying while the reopened stream keeps failing", async () => {
    subscribe();
    FakeEventSource.instances[0].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(30_000);
    FakeEventSource.instances[1].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeEventSource.instances).toHaveLength(3);
  });

  it("does not reconnect after cleanup while a reconnect is pending", async () => {
    subscribe();
    FakeEventSource.instances[0].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(10_000);
    unsubscribe?.();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reconnect after cleanup while the session check is pending", async () => {
    let resolveSession!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((res) => {
        resolveSession = res;
      }),
    );
    subscribe();
    FakeEventSource.instances[0].dispatchEvent(new Event("error"));
    unsubscribe?.();
    resolveSession({ ok: true, json: async () => ({}) } as Response);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops reconnecting when the session expires", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);
    subscribe();
    FakeEventSource.instances[0].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(90_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

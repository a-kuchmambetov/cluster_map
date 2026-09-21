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
  const onDelta = vi.fn();
  const onDbUnavailable = vi.fn();
  const refetchOccupancy = vi.fn<() => Promise<boolean>>();
  const subscribe = (enabled = true) => {
    unsubscribe = subscribeClusterEvents({
      clusterNumber: 2,
      enabled,
      onDelta,
      onDbUnavailable,
      refetchOccupancy,
    });
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    FakeEventSource.instances = [];
    refetchOccupancy.mockResolvedValue(true);
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

  it("keeps the stream open during DB failure and retries the snapshot until recovery", async () => {
    refetchOccupancy.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    subscribe();
    const source = FakeEventSource.instances[0];
    source.dispatchEvent(
      new MessageEvent("error", {
        data: JSON.stringify({ code: "DB_UNAVAILABLE" }),
      }),
    );
    expect(onDbUnavailable).toHaveBeenCalledOnce();
    expect(source.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refetchOccupancy).toHaveBeenCalledTimes(2);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes a snapshot before reconnecting after transport failure", async () => {
    refetchOccupancy.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    subscribe();
    const source = FakeEventSource.instances[0];
    source.dispatchEvent(new Event("error"));
    expect(source.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toBe("/api/clusters/2/events");
  });

  it("applies a delta and cancels pending DB recovery", async () => {
    subscribe();
    const source = FakeEventSource.instances[0];
    source.dispatchEvent(
      new MessageEvent("error", {
        data: JSON.stringify({ code: "DB_UNAVAILABLE" }),
      }),
    );
    const delta = { occupied: [], freed: [{ row: 1, place: 2 }] };
    source.dispatchEvent(
      new MessageEvent("occupancy-delta", { data: JSON.stringify(delta) }),
    );
    expect(onDelta).toHaveBeenCalledWith(delta);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refetchOccupancy).not.toHaveBeenCalled();
  });

  it("does not reconnect after cleanup while a recovery request is pending", async () => {
    let resolve!: (value: boolean) => void;
    refetchOccupancy.mockImplementation(
      () =>
        new Promise<boolean>((res) => {
          resolve = res;
        }),
    );
    subscribe();
    FakeEventSource.instances[0].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(30_000);
    unsubscribe?.();
    resolve(true);
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

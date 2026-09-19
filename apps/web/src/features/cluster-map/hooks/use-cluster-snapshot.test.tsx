import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClusterSnapshot } from "./use-cluster-snapshot";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("cluster snapshot ownership", () => {
  let root: Root;
  let container: HTMLDivElement;
  let result: ReturnType<typeof useClusterSnapshot<string>>;
  let requests: {
    cluster: number;
    signal?: AbortSignal;
    pending: ReturnType<typeof deferred<string>>;
  }[];
  const fetchSnapshot = vi.fn((cluster: number, signal?: AbortSignal) => {
    const pending = deferred<string>();
    requests.push({ cluster, signal, pending });
    return pending.promise;
  });
  function Harness({ cluster }: { cluster: number }) {
    result = useClusterSnapshot(cluster, fetchSnapshot);
    return <span>{result.data ?? "loading"}</span>;
  }
  const render = async (cluster: number) => {
    await act(async () => {
      root.render(
        <StrictMode>
          <Harness cluster={cluster} />
        </StrictMode>,
      );
    });
  };
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    requests = [];
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("ignores late responses after rapid switching, including StrictMode's cancelled request", async () => {
    await render(1);
    const first = requests.at(-1)!;
    await render(2);
    expect(first.signal?.aborted).toBe(true);
    const second = requests.at(-1)!;
    await act(async () => {
      second.pending.resolve("cluster 2");
    });
    await act(async () => {
      for (const request of requests.filter((r) => r.cluster === 1))
        request.pending.resolve("cluster 1");
    });
    expect(result.data).toBe("cluster 2");
    expect(result.loading).toBe(false);
  });

  it("hides a loaded previous cluster while its replacement loads", async () => {
    await render(1);
    await act(async () => {
      requests.at(-1)!.pending.resolve("cluster 1");
    });
    await render(2);
    expect(result.data).toBeNull();
    expect(result.loading).toBe(true);
    expect(container.textContent).toBe("loading");
  });

  it("keeps data on failed refresh and clears stale state on recovery", async () => {
    await render(1);
    await act(async () => {
      requests.at(-1)!.pending.resolve("snapshot");
    });
    let refresh!: Promise<boolean>;
    await act(async () => {
      refresh = result.refetch();
    });
    expect(result.refreshing).toBe(true);
    await act(async () => {
      requests.at(-1)!.pending.reject(new Error("offline"));
      await refresh;
    });
    expect(result.data).toBe("snapshot");
    expect(result.stale).toBe(true);
    expect(result.refreshing).toBe(false);
    await act(async () => {
      refresh = result.refetch();
    });
    await act(async () => {
      requests.at(-1)!.pending.resolve("recovered");
      await refresh;
    });
    expect(result.data).toBe("recovered");
    expect(result.stale).toBe(false);
    expect(result.error).toBeNull();
  });

  it("cancels superseded refreshes and prevents previous-cluster delta callbacks from updating new data", async () => {
    await render(1);
    await act(async () => {
      requests.at(-1)!.pending.resolve("one");
    });
    const oldUpdate = result.updateData;
    let firstRefresh!: Promise<boolean>;
    await act(async () => {
      firstRefresh = result.refetch();
    });
    const firstRequest = requests.at(-1)!;
    await render(2);
    await act(async () => {
      requests.at(-1)!.pending.resolve("two");
    });
    await act(async () => {
      firstRequest.pending.reject(new Error("late failure"));
      await firstRefresh;
      oldUpdate(() => "old delta");
    });
    expect(result.data).toBe("two");
    expect(result.error).toBeNull();
  });
});

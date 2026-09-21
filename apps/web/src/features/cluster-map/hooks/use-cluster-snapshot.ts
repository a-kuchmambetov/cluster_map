import { useCallback, useEffect, useRef, useState } from "react";

type Snapshot<T> = {
  clusterNumber: number;
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  error: Error | null;
};

const initialSnapshot = <T>(clusterNumber: number): Snapshot<T> => ({
  clusterNumber,
  data: null,
  loading: true,
  refreshing: false,
  stale: false,
  error: null,
});

// Layout and occupancy share request ownership, but keep independent snapshots.
export const useClusterSnapshot = <T>(
  clusterNumber: number,
  fetchSnapshot: (clusterNumber: number, signal?: AbortSignal) => Promise<T>,
) => {
  const [snapshot, setSnapshot] = useState(() =>
    initialSnapshot<T>(clusterNumber),
  );
  const requestRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setSnapshot((previous) => {
      const current =
        previous.clusterNumber === clusterNumber
          ? previous
          : initialSnapshot<T>(clusterNumber);
      return {
        ...current,
        loading: current.data === null,
        refreshing: current.data !== null,
        error: null,
      };
    });
    try {
      const data = await fetchSnapshot(clusterNumber, request.signal);
      // Also guard against transports that resolve after cancellation.
      if (request.signal.aborted) return false;
      setSnapshot({
        clusterNumber,
        data,
        loading: false,
        refreshing: false,
        stale: false,
        error: null,
      });
      return true;
    } catch (error) {
      if (request.signal.aborted) return false;
      setSnapshot((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        stale: current.data !== null,
        error: error instanceof Error ? error : new Error("Unknown error"),
      }));
      return false;
    }
  }, [clusterNumber, fetchSnapshot]);

  useEffect(() => {
    void refetch();
    return () => {
      requestRef.current?.abort();
    };
  }, [refetch]);

  const updateData = useCallback(
    (update: (current: T) => T) => {
      setSnapshot((current) =>
        current.clusterNumber === clusterNumber && current.data !== null
          ? {
              ...current,
              data: update(current.data),
              error: null,
              stale: false,
            }
          : current,
      );
    },
    [clusterNumber],
  );

  const markStale = useCallback(() => {
    setSnapshot((current) =>
      current.clusterNumber === clusterNumber && current.data !== null
        ? { ...current, stale: true }
        : current,
    );
  }, [clusterNumber]);

  // Hide the previous cluster immediately, before effects run for the new key.
  const current =
    snapshot.clusterNumber === clusterNumber
      ? snapshot
      : initialSnapshot<T>(clusterNumber);
  return { ...current, refetch, updateData, markStale };
};

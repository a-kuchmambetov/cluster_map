import { apiRequest, ApiError } from "@/lib/http";
import { API_URL } from "@/config/api";
import type {
  ClusterOccupancyResponse,
  OccupancyDelta,
  OccupancyStreamError,
} from "@repo/types";

// Delay before reopening a lost stream.
// Matching the server's 30-second polling cadence keeps retries reasonable.
const RECONNECT_RETRY_MS = 30_000;

export type ClusterEventsOptions = {
  clusterNumber: number;
  enabled: boolean;
  onSnapshot: (snapshot: ClusterOccupancyResponse) => void;
  onDelta: (delta: OccupancyDelta) => void;
  onStale: () => void;
};

export const subscribeClusterEvents = ({
  clusterNumber,
  enabled,
  onSnapshot,
  onDelta,
  onStale,
}: ClusterEventsOptions) => {
  // The stream is opened only after the initial occupancy request
  // has loaded successfully, so loading and error states stay with it.
  if (!enabled) {
    return;
  }

  let source: EventSource | null = null;
  const sessionCheck = new AbortController();

  // Used when the SSE connection itself is lost.
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Prevents async work from reopening streams after the component
  // has unmounted or the selected cluster has changed.
  let cancelled = false;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  /**
   * SSE reconnect path.
   *
   * When the stream itself is lost, events may have been missed.
   * Every new connection starts with a full occupancy-snapshot,
   * so reopening the stream is enough to resynchronize.
   */
  const scheduleReconnect = () => {
    // Avoid multiple reconnect timers running in parallel.
    if (cancelled || reconnectTimer !== null) {
      return;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openStream();
    }, RECONNECT_RETRY_MS);
  };

  /**
   * Opens the realtime SSE stream for the selected cluster.
   */
  const openStream = (): void => {
    if (cancelled) {
      return;
    }

    source = new EventSource(`${API_URL}/clusters/${clusterNumber}/events`, {
      withCredentials: true,
    });

    /**
     * Full occupancy state.
     *
     * Sent first on every connection and again after a DB outage.
     * It replaces whatever the client had, so state missed while
     * disconnected or stale during an outage is repaired.
     */
    source.addEventListener(
      "occupancy-snapshot",
      (event: MessageEvent<string>) => {
        onSnapshot(JSON.parse(event.data) as ClusterOccupancyResponse);
      },
    );

    /**
     * Normal realtime update, relative to the last snapshot:
     * - occupied: newly occupied places or changed peer data
     * - freed: places that became free
     */
    source.addEventListener(
      "occupancy-delta",
      (event: MessageEvent<string>) => {
        onDelta(JSON.parse(event.data) as OccupancyDelta);
      },
    );

    source.addEventListener("error", (event) => {
      /*
       * There are two different "error" cases here:
       *
       * 1. The API deliberately sends a named SSE "error"
       *    event when the database is unavailable.
       *
       * 2. EventSource itself emits a native error when the
       *    connection to the server is lost.
       *
       * These cases require different recovery strategies.
       */

      if (event instanceof MessageEvent) {
        const streamError = JSON.parse(event.data) as OccupancyStreamError;

        if (streamError.code === "DB_UNAVAILABLE") {
          // Keep the last successful occupancy visible,
          // mark it stale, and keep the SSE connection open.
          // The server sends a fresh snapshot once the DB recovers.
          onStale();
        }

        return;
      }

      // Native EventSource connection failure.
      //
      // Close the browser's automatic reconnect behavior and use our own
      // reconnect flow. The reopened stream starts with a full snapshot,
      // so missed events cannot leave the frontend out of sync. Until it
      // arrives, the visible occupancy is marked stale.
      source?.close();
      onStale();

      void apiRequest("/auth/session", { signal: sessionCheck.signal })
        .then(() => {
          if (!cancelled) scheduleReconnect();
          return undefined;
        })
        .catch((error) => {
          if (
            error instanceof ApiError &&
            (error.status === 401 || error.status === 403)
          ) {
            cancelled = true;
            clearReconnectTimer();
            return;
          }
          if (!cancelled) scheduleReconnect();
        });
    });
  };

  openStream();

  return () => {
    // Stops timers and async callbacks from reopening a stream
    // after unmount or cluster change.
    cancelled = true;
    sessionCheck.abort();

    clearReconnectTimer();
    source?.close();
  };
};

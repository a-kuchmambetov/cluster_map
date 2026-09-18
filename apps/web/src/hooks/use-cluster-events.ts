import { useEffect } from "react";
import type {
    OccupancyDelta,
    OccupancyStreamError,
} from "@repo/types";

// Used for both DB recovery retries and SSE reconnect retries.
// Matching the server's 30-second polling cadence keeps retries reasonable.
const RECOVERY_RETRY_MS = 30_000;

type UseClusterEventsOptions = {
    clusterNumber: number;
    enabled: boolean;
    onDelta: (delta: OccupancyDelta) => void;
    onDbUnavailable: () => void;
    refetchOccupancy: () => Promise<boolean>;
};

export const useClusterEvents = ({
    clusterNumber,
    enabled,
    onDelta,
    onDbUnavailable,
    refetchOccupancy,
}: UseClusterEventsOptions) => {

    useEffect(() => {
        // The stream is opened only after the initial occupancy snapshot
        // has loaded successfully.
        if (!enabled) {
            return;
        }

        let source: EventSource | null = null;

        // recoveryTimer:
        // Used when SSE is still connected but the API reports DB_UNAVAILABLE.
        let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

        // reconnectTimer:
        // Used when the SSE connection itself is lost and the occupancy
        // refresh also fails.
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        // Prevents async work from reopening streams after the component
        // has unmounted or the selected cluster has changed.
        let cancelled = false;

        const clearRecoveryTimer = () => {
            if (recoveryTimer !== null) {
                clearTimeout(recoveryTimer);
                recoveryTimer = null;
            }
        };

        // Declared before scheduleReconnect because reconnect logic
        // needs to call openStream after a successful occupancy refresh.
        let openStream: () => void;

        const clearReconnectTimer = () => {
            if (reconnectTimer !== null) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        /**
         * DB recovery path.
         *
         * The SSE connection is still alive, but the server could not
         * read occupancy from the database.
         *
         * We periodically re-fetch /occupancy so the frontend can clear
         * its stale state even if the database recovers without producing
         * an occupancy delta.
         */
        const scheduleRecovery = () => {
            // Only one recovery timer may exist at a time.
            if (cancelled || recoveryTimer !== null) {
                return;
            }

            recoveryTimer = setTimeout(async () => {
                recoveryTimer = null;

                if (cancelled) {
                    return;
                }

                const refreshed = await refetchOccupancy();

                // If the DB is still unavailable, keep the existing
                // occupancy visible and try again later.
                if (!refreshed && !cancelled) {
                    scheduleRecovery();
                }
            }, RECOVERY_RETRY_MS);
        };

        /**
         * SSE reconnect path.
         *
         * When the stream itself is lost, events may have been missed.
         * The contract therefore requires a fresh /occupancy snapshot
         * before opening the stream again.
         */
        const scheduleReconnect = () => {
            // Avoid multiple reconnect timers running in parallel.
            if (cancelled || reconnectTimer !== null) {
                return;
            }

            reconnectTimer = setTimeout(async () => {
                reconnectTimer = null;

                if (cancelled) {
                    return;
                }

                const refreshed = await refetchOccupancy();

                if (cancelled) {
                    return;
                }

                if (refreshed) {
                    // We are synchronized again, so realtime updates
                    // can safely resume.
                    openStream();
                } else {
                    // Still unable to obtain a trusted full snapshot.
                    scheduleReconnect();
                }
            }, RECOVERY_RETRY_MS);
        };

        /**
         * Opens the realtime SSE stream for the selected cluster.
         */
        openStream = () => {
            if (cancelled) {
                return;
            }

            source = new EventSource(
                `${import.meta.env.VITE_API_URL}/api/clusters/${clusterNumber}/events`,
            );

            /**
             * Normal realtime update.
             *
             * The server sends deltas only:
             * - occupied: newly occupied places or changed peer data
             * - freed: places that became free
             */
            source.addEventListener(
                "occupancy-delta",
                (event: MessageEvent<string>) => {
                    const delta = JSON.parse(
                        event.data,
                    ) as OccupancyDelta;

                    // Receiving a successful delta proves the DB is
                    // responding again, so any pending DB recovery
                    // refresh is no longer needed.
                    clearRecoveryTimer();

                    onDelta(delta);
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
                    const streamError = JSON.parse(
                        event.data,
                    ) as OccupancyStreamError;

                    if (streamError.code === "DB_UNAVAILABLE") {
                        // Keep the last successful occupancy visible,
                        // mark it stale, and keep the SSE connection open.
                        onDbUnavailable();

                        // Re-fetch later so stale can be cleared even if
                        // the DB recovers without any occupancy changes.
                        scheduleRecovery();
                    }

                    return;
                }

                // Native EventSource connection failure.
                //
                // Close the browser's automatic reconnect behavior and use our own
                // reconnect flow. Before reopening the stream, scheduleReconnect()
                // fetches a fresh /occupancy snapshot so missed events cannot leave
                // the frontend out of sync.
                clearRecoveryTimer();
                source?.close();

                scheduleReconnect();
            });
        };

        openStream();

        return () => {
            // Stops timers and async callbacks from reopening a stream
            // after unmount or cluster change.
            cancelled = true;

            clearRecoveryTimer();
            clearReconnectTimer();
            source?.close();
        };
    }, [
        clusterNumber,
        enabled,
        onDelta,
        onDbUnavailable,
        refetchOccupancy,
    ]);
};
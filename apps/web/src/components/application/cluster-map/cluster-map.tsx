import { useEffect, useState, useRef } from "react";
import type { ClusterMapView } from "@/types/cluster-map-view";
import {
    ClusterRowView,
    getClusterRowWidth,
} from "./cluster-row";
import { hexPts } from "@/utils/hex";
import { clusterPlaceStyles } from "@/utils/cluster-place-styles";


type ClusterMapProps = {
    map: ClusterMapView;
    refreshing?: boolean;
    stale?: boolean;
};

export const ClusterMap = ({
    map,
    refreshing = false,
    stale = false,
}: ClusterMapProps) => {


    const COMPACT_LABEL_GUTTER_REM = 1.5;
    const COMPACT_MAX_SCALE = 1.8;
    const COMPACT_MIN_SCALE = 0.8;
    const COMPACT_SIDE_SPACE_REM = 0.35;

    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
        null,
    );

    const [compactMobile, setCompactMobile] = useState(false);

    const [compactScale, setCompactScale] =
        useState(1);

    const [canScrollHorizontally, setCanScrollHorizontally] =
        useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 639px)");

        const update = () => {
            setCompactMobile(media.matches);
        };

        update();
        media.addEventListener("change", update);

        return () => {
            media.removeEventListener("change", update);
        };
    }, []);

    const baseCompactClusterWidth = Math.max(
        ...map.rows.map((row) =>
            getClusterRowWidth(row, true, 1),
        ),
    );

    useEffect(() => {
        if (!compactMobile) {
            setCompactScale(1);
            return;
        }

        const container = scrollContainerRef.current;

        if (!container) {
            return;
        }

        const updateScale = () => {
            const rootFontSize =
                parseFloat(
                    getComputedStyle(
                        document.documentElement,
                    ).fontSize,
                ) || 16;

            const availableWidthRem =
                container.clientWidth / rootFontSize;

            const usableWidthRem =
                availableWidthRem -
                COMPACT_LABEL_GUTTER_REM -
                COMPACT_SIDE_SPACE_REM;

            const scale =
                usableWidthRem /
                baseCompactClusterWidth;

            setCompactScale(
                Math.min(
                    COMPACT_MAX_SCALE,
                    Math.max(
                        COMPACT_MIN_SCALE,
                        scale,
                    ),
                ),
            );
        };

        updateScale();

        const observer =
            new ResizeObserver(updateScale);

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, [
        compactMobile,
        baseCompactClusterWidth,
        map.cluster.number,
    ]);

    useEffect(() => {
        setSelectedPlaceId(null);
    }, [map.cluster.number]);


    const handleClosePlace = () => {
        setSelectedPlaceId(null);
    };


    const handleSelectPlace = (placeId: string) => {
        setSelectedPlaceId((current) =>
            current === placeId ? null : placeId,
        );
    };
    const clusterWidth = Math.max(
        ...map.rows.map((row) =>
            getClusterRowWidth(
                row,
                compactMobile,
                compactScale,
            ),
        ),
    );

    useEffect(() => {
        const container = scrollContainerRef.current;

        if (!container) {
            return;
        }

        const updateScrollState = () => {
            setCanScrollHorizontally(
                container.scrollWidth > container.clientWidth + 1,
            );
        };

        updateScrollState();

        const observer = new ResizeObserver(updateScrollState);

        observer.observe(container);

        if (container.firstElementChild) {
            observer.observe(container.firstElementChild);
        }

        return () => {
            observer.disconnect();
        };
    }, [clusterWidth, map.cluster.number]);


    return (
        <div className="
                rounded-2xl
                border border-cluster-border
                bg-cluster-surface
                p-4
                shadow-xs
                sm:p-5
            "
        >
            {/* Cluster title + summary */}
            <div className="flex items-center justify-between gap-4 pb-1">
                <h2 className="text-lg font-semibold tracking-tight">
                    {map.cluster.label}
                </h2>

                <div className="
                        flex items-center gap-2
                        rounded-lg
                        bg-cluster-surface-soft
                        px-2 py-1.5
                        sm:gap-6
                        sm:rounded-xl
                        sm:px-4 sm:py-2
                ">
                    {/* Free */}
                    <div className="min-w-10 text-center sm:min-w-14">
                        <div className="text-base font-semibold text-cluster-free sm:text-xl">
                            {map.summary.free}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-tertiary">
                            Free
                        </div>
                    </div>

                    {/* Occupied */}
                    <div className="min-w-10 text-center sm:min-w-14">
                        <div className="text-base font-semibold text-cluster-occupied sm:text-xl">
                            {map.summary.occupied}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-tertiary">
                            Occupied
                        </div>
                    </div>

                    {/* Total */}
                    <div className="min-w-10 text-center sm:min-w-14">
                        <div className="text-base font-semibold text-primary sm:text-xl">
                            {map.summary.total}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-tertiary">
                            Total
                        </div>
                    </div>
                </div>
            </div>

            {/* No free places banner */}
            {map.summary.free === 0 && (
                <div className="
                        mt-5 rounded-xl
                        border border-cluster-border
                        bg-cluster-surface-soft
                        px-4 py-3
                ">
                    <div className="text-sm font-semibold text-primary">
                        No free places
                    </div>

                    <div className="mt-0.5 text-xs text-tertiary">
                        All places in this cluster are currently occupied.
                    </div>
                </div>
            )}

            {/* Map worning banner */}
            {map.warnings.length > 0 && (
                <div className="mt-5 space-y-2">
                    {map.warnings.map((warning) => (
                        <div
                            key={`${warning.code}-${warning.message}`}
                            className="
                    rounded-xl
                    border border-cluster-warning/30
                    bg-cluster-warning-soft
                    px-4 py-3
                "
                            role="status"
                        >
                            <div className="text-sm font-semibold text-cluster-warning-text">
                                Map configuration warning
                            </div>

                            <div className="mt-0.5 text-xs text-tertiary">
                                {warning.message}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/*Scrollable on mobile*/}
            {canScrollHorizontally && (
                <div className="mt-4 flex items-center justify-between sm:hidden">
                    <span className="text-xs text-tertiary">
                        Swipe to explore the cluster
                    </span>

                    <span
                        className="text-xs text-tertiary"
                        aria-hidden="true"
                    >
                        ↔
                    </span>
                </div>
            )}
            {/*Scrollable */}
            <div
                ref={scrollContainerRef}
                className="mt-2 overflow-x-auto overscroll-x-contain pb-2 sm:mt-5"
            >
                <div
                    className="mx-auto"
                    style={{
                        width: `${clusterWidth +
                            (compactMobile ? 1.5 : 3)
                            }rem`,
                    }}
                >
                    {map.rows.map((row) => (
                        <ClusterRowView
                            key={row.id}
                            row={row}
                            clusterWidth={clusterWidth}
                            compact={compactMobile}
                            compactScale={compactScale}
                            selectedPlaceId={selectedPlaceId}
                            onSelectPlace={handleSelectPlace}
                            onClosePlace={handleClosePlace}
                        />
                    ))}
                </div>
            </div>
            {/* Map legend, free/occupied */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-cluster-border pt-3 text-xs font-medium text-tertiary">
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2">
                        {/* Free icon */}
                        <svg
                            viewBox="0 0 100 100"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <polygon
                                points={hexPts(50, 50, 45)}
                                fill={clusterPlaceStyles.free.idle.fill}
                                stroke={clusterPlaceStyles.free.idle.stroke}
                                strokeWidth="4"
                            />
                        </svg>

                        <span>Free</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Occupied icon */}
                        <svg
                            viewBox="0 0 100 100"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <polygon
                                points={hexPts(50, 50, 45)}
                                fill={clusterPlaceStyles.occupied.idle.fill}
                                stroke={clusterPlaceStyles.occupied.idle.stroke}
                                strokeWidth="4"
                            />

                            <polygon
                                points={hexPts(50, 50, 28)}
                                fill={clusterPlaceStyles.occupied.idle.stroke}
                                opacity="0.5"
                                stroke="none"
                            />
                        </svg>

                        <span>Occupied</span>
                    </div>
                </div>

                {/* Last update stamp */}
                <div
                    className="w-full text-xs sm:ml-auto sm:w-auto sm:text-right"
                    role="status"
                    aria-live="polite"
                >
                    {refreshing ? (
                        <div className="flex items-center gap-2 text-tertiary">
                            <span
                                className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                                aria-hidden="true"
                            />

                            <span>Refreshing...</span>
                        </div>
                    ) : stale ? (
                        <div className="flex items-center gap-1.5 font-medium text-cluster-warning-text">
                            <span aria-hidden="true">!</span>

                            <span>Data may be outdated</span>

                            <span className="text-tertiary">
                                · Updated{" "}
                                {map.lastUpdated
                                    ? new Date(
                                        map.lastUpdated,
                                    ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })
                                    : "—"}
                            </span>
                        </div>
                    ) : (
                        <div className="font-normal text-tertiary">
                            Last updated{" "}
                            {map.lastUpdated
                                ? new Date(map.lastUpdated).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })
                                : "—"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


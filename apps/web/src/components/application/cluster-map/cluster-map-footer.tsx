import type { ClusterMapView } from "@/types/cluster-map-view";
import { hexPts } from "@/utils/hex";
import { clusterPlaceStyles } from "@/utils/cluster-place-styles";

type ClusterMapFooterProps = {
    map: ClusterMapView;
    refreshing: boolean;
    stale: boolean;
};

export const ClusterMapFooter = ({
    map,
    refreshing,
    stale,
}: ClusterMapFooterProps) => {
    const formattedLastUpdated = map.lastUpdated
        ? new Date(map.lastUpdated).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—";

    return (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-cluster-border pt-3 text-xs font-medium text-tertiary">
            <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
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
                            · Updated {formattedLastUpdated}
                        </span>
                    </div>
                ) : (
                    <div className="font-normal text-tertiary">
                        Last updated {formattedLastUpdated}
                    </div>
                )}
            </div>
        </div>
    );
};

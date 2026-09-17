import type { ClusterMapView } from "@/types/cluster-map-view";

type ClusterMapSummaryProps = {
    map: ClusterMapView;
};

export const ClusterMapSummary = ({
    map,
}: ClusterMapSummaryProps) => {
    return (
        <div className="flex items-center justify-between gap-4 pb-1">
            <h2 className="text-lg font-semibold tracking-tight">
                {map.cluster.label}
            </h2>

            <div
                className="
                    flex items-center gap-2
                    rounded-lg
                    bg-cluster-surface-soft
                    px-2 py-1.5
                    sm:gap-6
                    sm:rounded-xl
                    sm:px-4 sm:py-2
                "
            >
                <div className="min-w-10 text-center sm:min-w-14">
                    <div className="text-base font-semibold text-cluster-free sm:text-xl">
                        {map.summary.free}
                    </div>

                    <div className="mt-0.5 text-xs font-medium text-tertiary">
                        Free
                    </div>
                </div>

                <div className="min-w-10 text-center sm:min-w-14">
                    <div className="text-base font-semibold text-cluster-occupied sm:text-xl">
                        {map.summary.occupied}
                    </div>

                    <div className="mt-0.5 text-xs font-medium text-tertiary">
                        Occupied
                    </div>
                </div>

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
    );
};
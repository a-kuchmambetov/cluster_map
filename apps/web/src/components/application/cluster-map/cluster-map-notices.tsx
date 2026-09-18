import type { ClusterMapView } from "@/types/cluster-map-view";

type ClusterMapNoticesProps = {
    map: ClusterMapView;
};

export const ClusterMapNotices = ({
    map,
}: ClusterMapNoticesProps) => {
    return (
        <>
            {map.summary.free === 0 && (
                <div
                    className="
                        mt-5 rounded-xl
                        border border-cluster-border
                        bg-cluster-surface-soft
                        px-4 py-3
                    "
                >
                    <div className="text-sm font-semibold text-primary">
                        No free places
                    </div>

                    <div className="mt-0.5 text-xs text-tertiary">
                        All places in this cluster are currently occupied.
                    </div>
                </div>
            )}

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
        </>
    );
};

import type { Cluster } from "@repo/types";

type ClusterSelectorProps = {
    clusters: Cluster[];
    selectedCluster: number;
    onSelect: (clusterNumber: number) => void;
};

export const ClusterSelector = ({
    clusters,
    selectedCluster,
    onSelect,
}: ClusterSelectorProps) => {
    return (
        <div className="mt-6 flex flex-wrap gap-2">
            {clusters.map((cluster) => {
                const isActive =
                    cluster.number === selectedCluster;

                return (
                    <button
                        key={cluster.id}
                        type="button"
                        onClick={() => onSelect(cluster.number)}
                        className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200"
                        aria-pressed={isActive}
                        style={
                            isActive
                                ? {
                                    background: "#c47820",
                                    color: "#ffffff",
                                    boxShadow:
                                        "0 0 20px rgba(196, 120, 32, 0.25)",
                                }
                                : {
                                    background: "transparent",
                                    border: "1px solid #d0d5dd",
                                    color: "#667085",
                                }
                        }
                    >
                        C{cluster.number}
                    </button>
                );
            })}
        </div>
    );
};
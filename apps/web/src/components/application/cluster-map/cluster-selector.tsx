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
                        aria-pressed={isActive}
                        className="
                            min-w-12 rounded-full px-4 py-2
                            text-sm font-medium
                            hover:bg-secondary
                            transition-all duration-200
                            focus-visible:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-offset-2
                        "
                        style={
                            isActive
                                ? {
                                    background: "#c47820",
                                    color: "#fff",
                                    boxShadow: "0 0 16px rgba(196, 120, 32, 0.22)",
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
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
        <div className="flex flex-wrap gap-2">
            {clusters.map((cluster) => {
                const isActive =
                    cluster.number === selectedCluster;

                return (
                    <button
                        key={cluster.id}
                        type="button"
                        onClick={() =>
                            onSelect(cluster.number)
                        }
                        aria-pressed={isActive}
                        className={`
                            min-w-11 rounded-lg px-4 py-2
                            text-sm font-medium
                            transition-colors duration-200
                            focus-visible:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-cluster-accent/30
                            focus-visible:ring-offset-2

                            ${isActive
                                ? "bg-cluster-accent text-cluster-accent-text shadow-xs hover:bg-cluster-accent-hover"
                                : "border border-secondary bg-primary text-secondary hover:bg-secondary/40 hover:text-primary"
                            }
                        `}
                    >
                        C{cluster.number}
                    </button>
                );
            })}
        </div>
    );
};
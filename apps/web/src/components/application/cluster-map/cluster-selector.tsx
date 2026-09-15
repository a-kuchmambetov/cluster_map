import type { Cluster } from "@repo/types";
import { clusterMapTheme } from "@/utils/cluster-map-theme";

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
                            transition-all duration-200
                            focus-visible:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-[#c47820]/30
                            focus-visible:ring-offset-2

                        ${isActive
                                ? "text-white shadow-sm"
                                : "border border-secondary bg-primary text-secondary hover:bg-secondary/40 hover:text-primary"
                            }
`}
                        style={
                            isActive
                                ? {
                                    backgroundColor: clusterMapTheme.accent.base,
                                }
                                : undefined
                        }
                    >
                        C{cluster.number}
                    </button>
                );
            })}
        </div>
    );
};
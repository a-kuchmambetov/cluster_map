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
        <div className="mt-6">
            <label htmlFor="cluster-select">Cluster: </label>

            <select
                id="cluster-select"
                value={selectedCluster}
                onChange={(event) =>
                    onSelect(Number(event.target.value))
                }
            >
                {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.number}>
                        {cluster.label}
                    </option>
                ))}
            </select>
        </div>
    );
};
import type { ClusterMapResponse } from "@repo/types";
import { ClusterRowView } from "./cluster-row";

type ClusterMapProps = {
    map: ClusterMapResponse;
};

export const ClusterMap = ({ map }: ClusterMapProps) => {
    return (
        <div className="mt-8">
            <h2 className="text-xl font-semibold">
                {map.cluster.label}
            </h2>

            <p className="mt-2">
                Available places: {map.summary.free}
            </p>

            <div className="mt-6 space-y-4">
                {map.rows.map((row) => (
                    <ClusterRowView
                        key={row.id}
                        row={row}
                    />
                ))}
            </div>
        </div>
    );
};
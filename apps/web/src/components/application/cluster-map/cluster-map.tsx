import type { ClusterMapResponse } from "@repo/types";
import { ClusterRowView } from "./cluster-row";

type ClusterMapProps = {
    map: ClusterMapResponse;
};

export const ClusterMap = ({ map }: ClusterMapProps) => {
    return (
        <div className="mt-8">
            {/* Summary showing free/occupide/total places */}
            <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold">
                    {map.cluster.label}
                </h2>

                <div className="flex gap-6">
                    <div className="text-right">
                        <div className="text-xl font-bold text-success-primary">
                            {map.summary.free}
                        </div>
                        <div className="text-xs text-tertiary">
                            free
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xl font-bold">
                            {map.summary.occupied}
                        </div>
                        <div className="text-xs text-tertiary">
                            occupied
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xl font-bold">
                            {map.summary.total}
                        </div>
                        <div className="text-xs text-tertiary">
                            total
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-4">
                {map.rows.map((row, index) => (
                    <ClusterRowView
                        key={row.id}
                        row={row}
                        clusterNumber={map.cluster.number}
                        rowIndex={index}
                    />
                ))}
            </div>
            {/* Map legend, free/occupide */}
            <div className="mt-6 flex items-center flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <div
                        className="h-4 w-4"
                        style={{
                            background: "#eaf5ec",
                            border: "1px solid #2a8840",
                        }}
                    />
                    <span>Free</span>
                </div>

                <div className="flex items-center gap-2">
                    <div
                        className="h-4 w-4"
                        style={{
                            background: "#fff2e0",
                            border: "1px solid #c07020",
                        }}
                    />
                    <span>Occupied</span>
                </div>
                {/* Last update stamp */}
                <div className="ml-auto text-xs text-tertiary">
                    Updated{" "}
                    {map.lastUpdated
                        ? new Date(map.lastUpdated).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "—"}
                </div>
            </div>
        </div>
    );
};
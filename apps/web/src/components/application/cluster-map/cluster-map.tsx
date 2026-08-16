import type { ClusterMapResponse } from "@repo/types";
import { ClusterPlace } from "./cluster-place";

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
                    <div key={row.id}>
                        <h3 className="font-medium">
                            {row.label}
                        </h3>

                        <div className="mt-2 flex gap-2">
                            {row.cells.map((cell, index) => {
                                if (cell.kind === "gap") {
                                    return (
                                        <div
                                            key={`${row.id}-gap-${index}`}
                                            className="w-20"
                                        />
                                    );
                                }

                                return <ClusterPlace key={cell.id} place={cell} />;
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
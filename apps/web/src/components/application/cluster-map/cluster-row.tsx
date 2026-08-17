import type { ClusterRow } from "@repo/types";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterRow;
};

export const ClusterRowView = ({ row }: ClusterRowViewProps) => {
    return (
        <div>
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

                    return (
                        <ClusterPlace
                            key={cell.id}
                            place={cell}
                        />
                    );
                })}
            </div>
        </div>
    );
};
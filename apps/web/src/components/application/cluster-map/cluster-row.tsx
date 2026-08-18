import type { ClusterRow } from "@repo/types";
import { ClusterPlace } from "./cluster-place";
import { getPlacePosition } from "@/config/cluster-layout";

type ClusterRowViewProps = {
    row: ClusterRow;
    clusterNumber: number;
    rowIndex: number;
};

export const ClusterRowView = ({
    row,
    clusterNumber,
    rowIndex,
}: ClusterRowViewProps) => {
    return (
        <div>
            <h3 className="font-medium">
                {row.label}
            </h3>

            <div className="relative mt-2 h-56">
                {row.cells.map((cell, index) => {
                    if (cell.kind === "gap") {
                        return (
                            <div
                                key={`${row.id}-gap-${index}`}
                                className="w-20"
                            />
                        );
                    }

                    const position = getPlacePosition(
                        clusterNumber,
                        rowIndex,
                        cell.number,
                    );

                    return (
                        <div
                            key={cell.id}
                            className="absolute"
                            style={{
                                left: `${(position?.column ?? 0) * 7}rem`,
                                top: `${(position?.row ?? 0) * 7}rem`,
                            }}
                        >
                            <ClusterPlace place={cell} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
import type { ClusterRow } from "@repo/types";
import { getPlacePosition } from "@/config/cluster-layout";
import { ClusterPlace } from "./cluster-place";

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
                            />
                        );
                    }

                    const position = getPlacePosition(
                        clusterNumber,
                        rowIndex,
                        cell.number,
                    );

                    if (!position) {
                        return (
                            <ClusterPlace
                                key={cell.id}
                                place={cell}
                            />
                        );
                    }

                    return (
                        <div
                            key={cell.id}
                            className="absolute"
                            style={{
                                left: `${position.column * 7}rem`,
                                top: `${position.row * 3.5}rem`,
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
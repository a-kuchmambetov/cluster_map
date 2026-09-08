import type { ClusterRow } from "@repo/types";
import { getPlacePosition } from "@/config/cluster-layout";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterRow;
    clusterNumber: number;
    rowIndex: number;
    selectedPlaceId: string | null;
    onSelectPlace: (placeId: string) => void;
    onClosePlace: () => void;
};

export const ClusterRowView = ({
    row,
    clusterNumber,
    rowIndex,
    selectedPlaceId,
    onSelectPlace,
    onClosePlace,
}: ClusterRowViewProps) => {
    return (
        <div>
            <h3 className="text-sm font-medium text-tertiary">
                {row.label}
            </h3>

            <div className="relative mt-1.5 h-32">
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
                                selected={selectedPlaceId === cell.id}
                                onSelect={() => onSelectPlace(cell.id)}
                                onClose={onClosePlace}
                            />
                        );
                    }

                    return (
                        <div
                            key={cell.id}
                            className="absolute"
                            style={{
                                left: `${position.column * 5}rem`,
                                top: `${position.row * 2.5}rem`,
                            }}
                        >
                            <ClusterPlace
                                place={cell}
                                selected={selectedPlaceId === cell.id}
                                onSelect={() => onSelectPlace(cell.id)}
                                onClose={onClosePlace}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
import type { ClusterMapRow } from "@/types/cluster-map-view";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterMapRow;
    selectedPlaceId: string | null;
    onSelectPlace: (placeId: string) => void;
    onClosePlace: () => void;
};

export const ClusterRowView = ({
    row,
    selectedPlaceId,
    onSelectPlace,
    onClosePlace,
}: ClusterRowViewProps) => {
    let previousPosition: "top" | "bottom" | null = null;

    return (
        <div>
            <h3 className="text-sm font-medium text-tertiary">
                {row.label}
            </h3>

            <div className="relative mt-1.5 h-32">
                {row.cells.map((cell, index) => {
                    if (cell.kind === "gap") {
                        return null;
                    }

                    const position =
                        cell.position ??
                        (previousPosition === "top"
                            ? "bottom"
                            : "top");

                    previousPosition = position;

                    return (
                        <div
                            key={cell.id}
                            className="absolute"
                            style={{
                                left: `${index * 5}rem`,
                                top:
                                    position === "top"
                                        ? "0"
                                        : "2.5rem",
                            }}
                        >
                            <ClusterPlace
                                place={cell}
                                selected={selectedPlaceId === cell.id}
                                onSelect={() =>
                                    onSelectPlace(cell.id)
                                }
                                onClose={onClosePlace}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
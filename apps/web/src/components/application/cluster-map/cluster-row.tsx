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
    let columnOffset = 0;

    const PLACE_STEP_REM = 3.5;
    const GAP_STEP_REM = 1.25;
    const BOTTOM_OFFSET_REM = 2.2;

    return (
        <div>
            <h3 className="text-sm font-medium text-tertiary">
                {row.label}
            </h3>

            <div className="relative mt-1.5 h-28">
                {row.cells.map((cell) => {
                    if (cell.kind === "gap") {
                        columnOffset += GAP_STEP_REM;
                        return null;
                    }

                    const position =
                        cell.position ??
                        (previousPosition === "top"
                            ? "bottom"
                            : "top");

                    previousPosition = position;

                    const left = columnOffset;
                    columnOffset += PLACE_STEP_REM;

                    return (
                        <div
                            key={cell.id}
                            className="absolute"
                            style={{
                                left: `${left}rem`,
                                top:
                                    position === "top"
                                        ? "0"
                                        : `${BOTTOM_OFFSET_REM}rem`,
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
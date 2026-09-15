import type { ClusterMapRow } from "@/types/cluster-map-view";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterMapRow;
    selectedPlaceId: string | null;
    onSelectPlace: (placeId: string) => void;
    onClosePlace: () => void;
};

const PLACE_SIZE_REM = 4;
const PLACE_STEP_REM = 3.5;
const GAP_STEP_REM = 1.25;
const BOTTOM_OFFSET_REM = 2.2;

export const ClusterRowView = ({
    row,
    selectedPlaceId,
    onSelectPlace,
    onClosePlace,
}: ClusterRowViewProps) => {
    let previousPosition: "top" | "bottom" | null = null;
    let columnOffset = 0;
    const rowWidth =
        row.cells.reduce((width, cell) => {
            return (
                width +
                (cell.kind === "gap"
                    ? GAP_STEP_REM
                    : PLACE_STEP_REM)
            );
        }, 0) +
        (PLACE_SIZE_REM - PLACE_STEP_REM);

    return (
        <div style={{ width: `${rowWidth}rem` }}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary">
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
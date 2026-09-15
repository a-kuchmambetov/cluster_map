import type { ClusterMapRow } from "@/types/cluster-map-view";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterMapRow;
    clusterWidth: number;
    selectedPlaceId: string | null;
    onSelectPlace: (placeId: string) => void;
    onClosePlace: () => void;
};

const PLACE_SIZE_REM = 4;
const PLACE_STEP_REM = 3;
const GAP_STEP_REM = 4;


type ResolvedPlace = {
    cell: Extract<ClusterMapRow["cells"][number], { kind: "place" }>;
    position: "top" | "bottom";
    left: number;
};

const resolveRowPlaces = (
    row: ClusterMapRow,
): ResolvedPlace[] => {
    let previousPosition: "top" | "bottom" | null = null;
    let columnOffset = 0;

    const places: ResolvedPlace[] = [];

    for (const cell of row.cells) {
        if (cell.kind === "gap") {
            columnOffset += GAP_STEP_REM;
            continue;
        }

        const position: "top" | "bottom" =
            cell.position ??
            (previousPosition === "top"
                ? "bottom"
                : "top");

        places.push({
            cell,
            position,
            left: columnOffset,
        });

        previousPosition = position;
        columnOffset += PLACE_STEP_REM;
    }

    return places;
};

export const getClusterRowWidth = (row: ClusterMapRow) =>
    row.cells.reduce((width, cell) => {
        return (
            width +
            (cell.kind === "gap"
                ? GAP_STEP_REM
                : PLACE_STEP_REM)
        );
    }, 0) +
    (PLACE_SIZE_REM - PLACE_STEP_REM);

export const ClusterRowView = ({
    row,
    clusterWidth,
    selectedPlaceId,
    onSelectPlace,
    onClosePlace,
}: ClusterRowViewProps) => {
    const resolvedPlaces = resolveRowPlaces(row);

    const usesBothLevels =
        resolvedPlaces.some(
            ({ position }) => position === "top",
        ) &&
        resolvedPlaces.some(
            ({ position }) => position === "bottom",
        );

    const rowWidth = getClusterRowWidth(row);
    const rowOffset = (clusterWidth - rowWidth) / 2;

    return (
        <div className="flex items-center gap-4">
            <h3 className="w-8 shrink-0 text-right text-base font-semibold text-tertiary/70 sm:text-lg">
                {row.label}
            </h3>

            <div
                className={
                    usesBothLevels
                        ? "relative h-[5.75rem] shrink-0 sm:h-28"
                        : "relative h-16 shrink-0 sm:h-20"
                }
                style={{ width: `${clusterWidth}rem` }}
            >
                {resolvedPlaces.map(({ cell, position, left }) => (
                    <div
                        key={cell.id}
                        className={
                            position === "top"
                                ? "absolute top-0"
                                : "absolute top-[1.75rem] sm:top-[2.2rem]"
                        }
                        style={{
                            left: `${rowOffset + left}rem`,
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
                ))}
            </div>
        </div>
    );
};
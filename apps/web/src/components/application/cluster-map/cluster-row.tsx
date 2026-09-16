import type { ClusterMapRow } from "@/types/cluster-map-view";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterMapRow;
    clusterWidth: number;
    compact: boolean;
    selectedPlaceId: string | null;
    onSelectPlace: (placeId: string) => void;
    onClosePlace: () => void;
};

const DESKTOP_GEOMETRY = {
    placeSize: 4,
    placeStep: 3,
    gapStep: 4,
    bottomOffset: 2.2,
};

const MOBILE_GEOMETRY = {
    placeSize: 1.35,     // ~22px visible hex
    placeStep: 0.8,      // ~13px horizontal advance
    gapStep: 1.15,       // ~18px physical group gap
    bottomOffset: 0.65,  // ~10px stagger
};

type ResolvedPlace = {
    cell: Extract<ClusterMapRow["cells"][number], { kind: "place" }>;
    position: "top" | "bottom";
    left: number;
};

const resolveRowPlaces = (
    row: ClusterMapRow,
    compact: boolean,
): ResolvedPlace[] => {
    const geometry = compact
        ? MOBILE_GEOMETRY
        : DESKTOP_GEOMETRY;

    let previousPosition: "top" | "bottom" | null = null;
    let columnOffset = 0;

    const places: ResolvedPlace[] = [];

    for (const cell of row.cells) {
        if (cell.kind === "gap") {
            columnOffset += geometry.gapStep;
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
        columnOffset += geometry.placeStep;
    }

    return places;
};

export const getClusterRowWidth = (
    row: ClusterMapRow,
    compact = false,
) => {
    const geometry = compact
        ? MOBILE_GEOMETRY
        : DESKTOP_GEOMETRY;

    return (
        row.cells.reduce((width, cell) => {
            return (
                width +
                (cell.kind === "gap"
                    ? geometry.gapStep
                    : geometry.placeStep)
            );
        }, 0) +
        (geometry.placeSize - geometry.placeStep)
    );
};

export const ClusterRowView = ({
    row,
    clusterWidth,
    compact,
    selectedPlaceId,
    onSelectPlace,
    onClosePlace,
}: ClusterRowViewProps) => {
    const geometry = compact
        ? MOBILE_GEOMETRY
        : DESKTOP_GEOMETRY;

    const resolvedPlaces = resolveRowPlaces(row, compact);

    const usesBothLevels =
        resolvedPlaces.some(
            ({ position }) => position === "top",
        ) &&
        resolvedPlaces.some(
            ({ position }) => position === "bottom",
        );

    const rowWidth = getClusterRowWidth(row, compact);
    const rowOffset = (clusterWidth - rowWidth) / 2;

    return (
        <div
            className={
                compact
                    ? "flex items-center gap-2"
                    : "flex items-center gap-4"
            }
        >
            <h3
                className={
                    compact
                        ? "w-6 shrink-0 text-right text-xs font-medium text-tertiary"
                        : "w-8 shrink-0 text-right text-base font-medium text-tertiary"
                }
            >
                {row.label}
            </h3>

            <div
                className={
                    compact
                        ? usesBothLevels
                            ? "relative h-[2.25rem] shrink-0"
                            : "relative h-[1.5rem] shrink-0"
                        : usesBothLevels
                            ? "relative h-28 shrink-0"
                            : "relative h-20 shrink-0"
                }
                style={{ width: `${clusterWidth}rem` }}
            >
                {resolvedPlaces.map(({ cell, position, left }) => (

                    <div
                        key={cell.id}
                        className="absolute"
                        style={{
                            left: `${rowOffset + left}rem`,
                            top:
                                position === "top"
                                    ? "0"
                                    : `${geometry.bottomOffset}rem`,
                        }}
                    >
                        <ClusterPlace
                            place={cell}
                            compact={compact}
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
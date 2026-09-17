import type { ClusterMapRow } from "@/types/cluster-map-view";
import { ClusterPlace } from "./cluster-place";

type ClusterRowViewProps = {
    row: ClusterMapRow;
    clusterWidth: number;
    compact: boolean;
    compactScale: number;
    selectedPlaceId: string | null;
    onSelectPlace: (placeId: string) => void;
    onClosePlace: () => void;
};

const DESKTOP_GEOMETRY = {
    placeSize: 4,
    placeStep: 2.88,
    gapStep: 4,
    bottomOffset: 2.19,
};

const MOBILE_GEOMETRY = {
    placeSize: 1.35,
    placeStep: 0.7,
    gapStep: 1.0,
    bottomOffset: 0.8,
};

const getGeometry = (
    compact: boolean,
    compactScale = 1,
) => {
    const base = compact
        ? MOBILE_GEOMETRY
        : DESKTOP_GEOMETRY;

    if (!compact) {
        return base;
    }

    return {
        placeSize: base.placeSize * compactScale,
        placeStep: base.placeStep * compactScale,
        gapStep: base.gapStep * compactScale,
        bottomOffset: base.bottomOffset * compactScale,
    };
};

type ResolvedPlace = {
    cell: Extract<ClusterMapRow["cells"][number], { kind: "place" }>;
    position: "top" | "bottom";
    left: number;
};

const resolveRowPlaces = (
    row: ClusterMapRow,
    compact: boolean,
    compactScale = 1,
): ResolvedPlace[] => {
    const geometry = getGeometry(
        compact,
        compactScale,
    );

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
    compactScale = 1,
) => {
    const geometry = getGeometry(
        compact,
        compactScale,
    );

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
    compactScale,
    selectedPlaceId,
    onSelectPlace,
    onClosePlace,
}: ClusterRowViewProps) => {
    const geometry = getGeometry(
        compact,
        compactScale,
    );

    const resolvedPlaces = resolveRowPlaces(
        row,
        compact,
        compactScale,
    );

    const usesBothLevels =
        resolvedPlaces.some(
            ({ position }) => position === "top",
        ) &&
        resolvedPlaces.some(
            ({ position }) => position === "bottom",
        );

    const rowWidth = getClusterRowWidth(
        row,
        compact,
        compactScale,
    );
    const rowOffset = (clusterWidth - rowWidth) / 2;

    return (
        <div
            className={
                compact
                    ? "flex items-center gap-1"
                    : "flex items-center gap-4"
            }
        >
            <h3
                className={
                    compact
                        ? "w-5 shrink-0 text-right text-xs font-medium text-tertiary"
                        : "w-8 shrink-0 text-right text-base font-medium text-tertiary"
                }
            >
                {row.label}
            </h3>

            <div
                className={
                    compact
                        ? "relative shrink-0"
                        : usesBothLevels
                            ? "relative h-28 shrink-0"
                            : "relative h-20 shrink-0"
                }
                style={{
                    width: `${clusterWidth}rem`,
                    ...(compact
                        ? {
                            height: `${usesBothLevels
                                ? geometry.placeSize +
                                geometry.bottomOffset +
                                0.2
                                : geometry.placeSize + 0.2
                                }rem`,
                        }
                        : {}),
                }}
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
                            compactScale={compactScale}
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
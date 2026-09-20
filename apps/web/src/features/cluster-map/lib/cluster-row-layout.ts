import type { ClusterMapRow } from "../model/cluster-map-view";

export const DESKTOP_GEOMETRY = {
  placeSize: 4,
  placeStep: 2.88,
  gapStep: 4,
  bottomOffset: 2.19,
};

export const MOBILE_GEOMETRY = {
  placeSize: 1.35,
  placeStep: 0.7,
  gapStep: 1.0,
  bottomOffset: 0.8,
};

export const getGeometry = (compact: boolean, compactScale = 1) => {
  const base = compact ? MOBILE_GEOMETRY : DESKTOP_GEOMETRY;

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

export type ResolvedPlace = {
  cell: Extract<ClusterMapRow["cells"][number], { kind: "place" }>;
  position: "top" | "bottom";
  left: number;
};

export const resolveRowPlaces = (
  row: ClusterMapRow,
  compact: boolean,
  compactScale = 1,
): ResolvedPlace[] => {
  const geometry = getGeometry(compact, compactScale);

  let previousPosition: "top" | "bottom" | null = null;

  let columnOffset = 0;

  const places: ResolvedPlace[] = [];

  for (const cell of row.cells) {
    if (cell.kind === "gap") {
      columnOffset += geometry.gapStep;
      continue;
    }

    const position: "top" | "bottom" =
      cell.position ?? (previousPosition === "top" ? "bottom" : "top");

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
  const geometry = getGeometry(compact, compactScale);

  return (
    row.cells.reduce((width, cell) => {
      return (
        width + (cell.kind === "gap" ? geometry.gapStep : geometry.placeStep)
      );
    }, 0) +
    (geometry.placeSize - geometry.placeStep)
  );
};

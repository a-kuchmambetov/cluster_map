import type { ClusterMapRow } from "../model/cluster-map-view";
import { ClusterPlace } from "./cluster-place";
import {
  getClusterRowWidth,
  getGeometry,
  resolveRowPlaces,
} from "../lib/cluster-row-layout";

type ClusterRowViewProps = {
  row: ClusterMapRow;
  clusterWidth: number;
  compact: boolean;
  compactScale: number;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onClosePlace: () => void;
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
  const geometry = getGeometry(compact, compactScale);

  const resolvedPlaces = resolveRowPlaces(row, compact, compactScale);

  const usesBothLevels =
    resolvedPlaces.some(({ position }) => position === "top") &&
    resolvedPlaces.some(({ position }) => position === "bottom");

  const rowWidth = getClusterRowWidth(row, compact, compactScale);

  const rowOffset = (clusterWidth - rowWidth) / 2;

  return (
    <div
      className={
        compact ? "flex items-center gap-1" : "flex items-center gap-4"
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
                height: `${
                  usesBothLevels
                    ? geometry.placeSize + geometry.bottomOffset + 0.2
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
              top: position === "top" ? "0" : `${geometry.bottomOffset}rem`,
            }}
          >
            <ClusterPlace
              place={cell}
              compact={compact}
              compactScale={compactScale}
              selected={selectedPlaceId === cell.id}
              onSelect={() => onSelectPlace(cell.id)}
              onClose={onClosePlace}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

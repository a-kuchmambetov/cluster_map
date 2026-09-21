import { useState } from "react";
import { ClusterPlacePopup } from "./cluster-place-popup";
import type { ClusterMapPlaceCell } from "../model/cluster-map-view";
import { hexPts } from "@/utils/hex";
import { clusterPlaceStyles } from "../lib/cluster-place-styles";
import { useClusterPlacePopup } from "../hooks/use-cluster-place-popup";

type ClusterPlaceProps = {
  place: ClusterMapPlaceCell;
  selected: boolean;
  compact: boolean;
  compactScale: number;
  onSelect: () => void;
  onClose: () => void;
};

export const ClusterPlace = ({
  place,
  selected,
  compact,
  compactScale,
  onSelect,
  onClose,
}: ClusterPlaceProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const compactSize = 1.35 * compactScale;
  const compactFontSize = Math.min(10, 7 * compactScale);

  const isOccupied = place.status === "occupied";

  const typeStyles = isOccupied
    ? clusterPlaceStyles.occupied
    : clusterPlaceStyles.free;

  const styles = selected
    ? clusterPlaceStyles.selected
    : isHovered
      ? typeStyles.hover
      : typeStyles.idle;

  const handleClick = () => {
    if (!isOccupied) {
      return;
    }

    onSelect();
  };
  const { containerRef, buttonRef, popupRef, popupPosition } =
    useClusterPlacePopup({
      selected,
      onClose,
    });

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        tabIndex={isOccupied ? 0 : -1}
        aria-expanded={isOccupied ? selected : undefined}
        aria-controls={
          isOccupied && place.peer ? `peer-${place.id}` : undefined
        }
        aria-label={`Place ${place.number}, ${
          isOccupied ? "occupied" : "free"
        }`}
        className={`group relative ${compact ? "" : "h-16 w-16"} transition-transform duration-150 focus:outline-none ${
          isOccupied && !compact ? "hover:-translate-y-0.5" : ""
        } `}
        style={
          compact
            ? {
                width: `${compactSize}rem`,
                height: `${compactSize}rem`,
              }
            : undefined
        }
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {/* keyboard focus ring */}
          <polygon
            points={hexPts(50, 50, 46)}
            fill="none"
            stroke="var(--color-cluster-accent)"
            strokeWidth="2"
            strokeDasharray="5 2"
            className="opacity-0 transition-opacity duration-150 group-focus-visible:opacity-100"
          />
          {/* hover / selected glow */}
          {(isHovered || selected) && (
            <polygon
              points={hexPts(50, 50, 44)}
              fill={styles.stroke}
              opacity="0.12"
              stroke="none"
            />
          )}
          {/* selected ring */}
          {selected && (
            <polygon
              points={hexPts(50, 50, 41.5)}
              fill="none"
              stroke={styles.stroke}
              strokeWidth="4"
              opacity="0.25"
            />
          )}
          {/* main hex */}
          <polygon
            points={hexPts(50, 50, 40)}
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={selected ? 2 : isHovered ? 1.5 : 1}
          />
          {/* extra filling for occupied */}
          {isOccupied && (
            <polygon
              points={hexPts(50, 50, 34)}
              fill={styles.stroke}
              opacity="0.25"
              stroke="none"
            />
          )}
        </svg>

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: styles.text }}
        >
          <span
            className={`font-mono font-medium ${compact ? "" : "text-xs"} `}
            style={
              compact
                ? {
                    fontSize: `${compactFontSize}px`,
                  }
                : undefined
            }
          >
            {place.number}
          </span>
        </div>
      </button>
      {/* New popup for the occupide. Photo support, handles missing displayname intraname. Both missing, still show occupied. Truncates name and intraname in case too long.*/}
      <ClusterPlacePopup
        place={place}
        selected={selected}
        popupPosition={popupPosition}
        popupRef={popupRef}
        onClose={onClose}
      />
    </div>
  );
};

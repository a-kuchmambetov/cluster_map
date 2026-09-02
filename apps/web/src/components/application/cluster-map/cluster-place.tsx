import { useEffect, useRef, useState } from "react";
import type { PlaceCell } from "@repo/types";
import { hexPts } from "@/utils/hex";
import { clusterPlaceStyles } from "@/utils/cluster-place-styles";

type ClusterPlaceProps = {
    place: PlaceCell;
    selected: boolean;
    onSelect: () => void;
};

export const ClusterPlace = ({ place, selected, onSelect }: ClusterPlaceProps) => {
    const [isHovered, setIsHovered] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

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
    // added for closing popup by clicking on random place on the map
    useEffect(() => {
        if (!selected) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                onSelect();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);

        return () => {
            document.removeEventListener(
                "pointerdown",
                handlePointerDown,
            );
        };
    }, [selected, onSelect]);
    // added for closing popup with ESC button
    useEffect(() => {
        if (!selected) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onSelect();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [selected, onSelect]);

    return (
        <div
            ref={containerRef}
            className="relative"
        >
            <button
                type="button"
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                aria-expanded={isOccupied ? selected : undefined}
                aria-controls={
                    isOccupied && place.peer
                        ? `peer-${place.id}`
                        : undefined
                }
                aria-label={`Place ${place.number}, ${isOccupied ? "occupied" : "free"
                    }`}
                className="relative h-28 w-28"
            >
                <svg
                    viewBox="0 0 100 100"
                    className="h-full w-full"
                >
                    {selected && (
                        <polygon
                            points={hexPts(50, 50, 44)}
                            fill={styles.stroke}
                            opacity="0.12"
                            stroke="none"
                        />
                    )}

                    {selected && (
                        <polygon
                            points={hexPts(50, 50, 41.5)}
                            fill="none"
                            stroke={styles.stroke}
                            strokeWidth="4"
                            opacity="0.25"
                        />
                    )}

                    <polygon
                        points={hexPts(50, 50, 40)}
                        fill={styles.fill}
                        stroke={styles.stroke}
                        strokeWidth={
                            selected
                                ? 2
                                : isHovered
                                    ? 1.5
                                    : 1
                        }
                    />
                </svg>
                {/*free vs occupide only by color*/}
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: styles.text }}
                >
                    <span className="font-mono text-sm font-medium">
                        {place.number}
                    </span>
                </div>
            </button>
            {/* New popup for the occupide. Photo support, handles missing displayname intraname. Both missing, still show occupied. Truncates name and intraname in case too long.*/}
            {selected && place.peer && (
                <div
                    id={`peer-${place.id}`}
                    className="absolute left-full top-1/2 z-20 ml-4 w-56 -translate-y-1/2 rounded-xl border border-secondary bg-primary p-4 shadow-lg"
                >
                    <button
                        type="button"
                        onClick={onSelect}
                        aria-label="Close peer details"
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-secondary"
                    >
                        ×
                    </button>
                    <div className="mb-3 text-xs text-tertiary">
                        Place {place.number}
                    </div>

                    <div className="flex items-center gap-3">
                        {place.peer.photo && (
                            <img
                                src={place.peer.photo}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                            />
                        )}

                        <div className="min-w-0">
                            {place.peer.displayName && (
                                <div className="truncate font-medium">
                                    {place.peer.displayName}
                                </div>
                            )}

                            {place.peer.intraName && (
                                <div className="truncate text-sm text-tertiary">
                                    @{place.peer.intraName}
                                </div>
                            )}

                            {!place.peer.displayName &&
                                !place.peer.intraName && (
                                    <div className="text-sm text-tertiary">
                                        Occupied
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
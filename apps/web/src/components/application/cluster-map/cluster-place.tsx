import { useEffect, useRef, useState } from "react";
import type { PlaceCell } from "@repo/types";
import { hexPts } from "@/utils/hex";
import { clusterPlaceStyles } from "@/utils/cluster-place-styles";

type ClusterPlaceProps = {
    place: PlaceCell;
    selected: boolean;
    onSelect: () => void;
    onClose: () => void;
};

export const ClusterPlace = ({
    place,
    selected,
    onSelect,
    onClose,
}: ClusterPlaceProps) => {
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

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener(
                "click",
                handleClickOutside,
            );
        };
    }, [selected, onClose]);

    // added for closing popup with ESC button
    useEffect(() => {
        if (!selected) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [selected, onClose]);

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
                    {(isHovered || selected) && (
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
                    {/* made occupied visually filled, like in real hive*/}
                    {isOccupied && (
                        <polygon
                            points={hexPts(50, 50, 34)}
                            fill={styles.stroke}
                            opacity="0.25"
                            stroke="none"
                        />
                    )}
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
                    className="
                        fixed inset-x-4 bottom-4 z-50
                        rounded-xl border border-secondary bg-primary p-4 shadow-lg

                        sm:absolute sm:inset-x-auto sm:bottom-auto
                        sm:left-full sm:top-1/2 sm:ml-4 sm:w-56
                        sm:-translate-y-1/2
                    "
                >
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close peer details"
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-secondary"
                    >
                        ×
                    </button>

                    <div className="mb-3 pr-8">
                        <div className="text-sm font-medium">
                            Place {place.number}
                        </div>

                        <div className="mt-0.5 text-xs text-tertiary">
                            Occupied
                        </div>
                    </div>

                    <div className="mb-4 border-t border-secondary" />

                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-tertiary">
                            {place.peer.photo ? (
                                <img
                                    src={place.peer.photo}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span>
                                    {place.peer.displayName?.charAt(0).toUpperCase()
                                        ?? place.peer.intraName?.charAt(0).toUpperCase()
                                        ?? "?"}
                                </span>
                            )}
                        </div>

                        {/* Peer details */}
                        <div className="min-w-0">
                            {place.peer.displayName && (
                                <div className="truncate text-sm font-semibold">
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
                                        Peer information unavailable
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
import { useState } from "react";
import type { PlaceCell } from "@repo/types";
import { hexPts } from "@/utils/hex";
import { clusterPlaceStyles } from "@/utils/cluster-place-styles";

type ClusterPlaceProps = {
    place: PlaceCell;
};

export const ClusterPlace = ({ place }: ClusterPlaceProps) => {
    const [showPeer, setShowPeer] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const isOccupied = place.status === "occupied";

    const typeStyles = isOccupied
        ? clusterPlaceStyles.occupied
        : clusterPlaceStyles.free;

    const styles = showPeer
        ? clusterPlaceStyles.selected
        : isHovered
            ? typeStyles.hover
            : typeStyles.idle;

    const handleClick = () => {
        if (!isOccupied) {
            return;
        }

        setShowPeer((current) => !current);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative h-28 w-28"
            >
                <svg
                    viewBox="0 0 100 100"
                    className="h-full w-full"
                >
                    {(isHovered || showPeer) && (
                        <polygon
                            points={hexPts(50, 50, 44)}
                            fill={styles.stroke}
                            opacity="0.12"
                            stroke="none"
                        />
                    )}

                    {showPeer && (
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
                            showPeer
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
            {showPeer && place.peer && (
                <div className="absolute left-full top-1/2 z-20 ml-4 w-56 -translate-y-1/2 rounded-xl border border-secondary bg-primary p-4 shadow-lg">
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
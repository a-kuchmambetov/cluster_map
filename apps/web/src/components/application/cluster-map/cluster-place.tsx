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

    const styles = isHovered
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
                //disabled={!isOccupied}
                className="relative h-28 w-28"
            >
                <svg
                    viewBox="0 0 100 100"
                    className="h-full w-full"
                >
                    <polygon
                        points={hexPts(50, 50, 42)}
                        fill={styles.fill}
                        stroke={styles.stroke}
                        strokeWidth="2"
                    />
                </svg>

                <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ color: styles.text }}
                >
                    <div className="font-medium">
                        {place.number}
                    </div>

                    <div className="text-xs">
                        {isOccupied ? "Occupied" : "Free"}
                    </div>
                </div>
            </button>

            {showPeer && place.peer && (
                <div className="absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 rounded-lg border bg-primary p-3 text-sm shadow-lg">
                    <div className="font-medium">
                        {place.peer.displayName}
                    </div>

                    <div className="text-tertiary">
                        @{place.peer.intraName}
                    </div>
                </div>
            )}
        </div>
    );
};
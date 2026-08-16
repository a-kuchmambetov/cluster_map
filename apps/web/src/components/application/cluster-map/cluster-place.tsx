import type { PlaceCell } from "@repo/types";

type ClusterPlaceProps = {
    place: PlaceCell;
};

export const ClusterPlace = ({ place }: ClusterPlaceProps) => {
    const isOccupied = place.status === "occupied";

    return (
        <div className="flex h-20 w-20 items-center justify-center border">
            <div className="text-center">
                <div>Place {place.number}</div>

                <div>
                    {isOccupied ? "Occupied" : "Free"}
                </div>

                {isOccupied && place.peer && (
                    <div className="text-sm">
                        {place.peer.displayName}
                    </div>
                )}
            </div>
        </div>
    );
};
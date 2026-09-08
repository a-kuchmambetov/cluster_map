import { useEffect, useState } from "react";
import type { ClusterMapResponse } from "@repo/types";
import { ClusterRowView } from "./cluster-row";
import { hexPts } from "@/utils/hex";

type ClusterMapProps = {
    map: ClusterMapResponse;
};

export const ClusterMap = ({ map }: ClusterMapProps) => {
    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
        null,
    );
    const handleClosePlace = () => {
        setSelectedPlaceId(null);
    };
    useEffect(() => {
        setSelectedPlaceId(null);
    }, [map.cluster.number]);

    const handleSelectPlace = (placeId: string) => {
        setSelectedPlaceId((current) =>
            current === placeId ? null : placeId,
        );
    };
    return (
        <div className="mt-8 rounded-2xl border border-secondary bg-primary p-4 shadow-sm sm:p-6">
            {/* Cluster title + summary */}
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">
                    {map.cluster.label}
                </h2>

                <div className="flex items-center gap-5 sm:gap-8">
                    {/* Free */}
                    <div className="min-w-14 text-center">
                        <div className="text-2xl font-semibold text-success-primary">
                            {map.summary.free}
                        </div>
                        <div className="mt-0.5 text-xs text-tertiary">
                            Free
                        </div>
                    </div>

                    {/* Occupied */}
                    <div className="min-w-14 text-center">
                        <div
                            className="text-2xl font-semibold"
                            style={{ color: "#c07020" }}
                        >
                            {map.summary.occupied}
                        </div>
                        <div className="mt-0.5 text-xs text-tertiary">
                            Occupied
                        </div>
                    </div>

                    {/* Total */}
                    <div className="min-w-14 text-center">
                        <div className="text-2xl font-semibold text-primary">
                            {map.summary.total}
                        </div>
                        <div className="mt-0.5 text-xs text-tertiary">
                            Total
                        </div>
                    </div>
                </div>
            </div>
            {/*Scrollable */}
            <div className="mt-8 overflow-x-auto">
                <div className="space-y-3">
                    {map.rows.map((row, index) => (
                        <ClusterRowView
                            key={row.id}
                            row={row}
                            clusterNumber={map.cluster.number}
                            rowIndex={index}
                            selectedPlaceId={selectedPlaceId}
                            onSelectPlace={handleSelectPlace}
                            onClosePlace={handleClosePlace}
                        />
                    ))}
                </div>
            </div>
            {/* Map legend, free/occupied */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-secondary pt-4 text-sm text-tertiary">
                <div className="flex items-center gap-2">
                    <svg
                        viewBox="0 0 100 100"
                        className="h-5 w-5"
                        aria-hidden="true"
                    >
                        <polygon
                            points={hexPts(50, 50, 45)}
                            fill="#eaf5ec"
                            stroke="#2a8840"
                            strokeWidth="4"
                        />
                    </svg>

                    <span>Free</span>
                </div>

                <div className="flex items-center gap-2">
                    <svg
                        viewBox="0 0 100 100"
                        className="h-5 w-5"
                        aria-hidden="true"
                    >
                        <polygon
                            points={hexPts(50, 50, 45)}
                            fill="#fff2e0"
                            stroke="#c07020"
                            strokeWidth="4"
                        />

                        <polygon
                            points={hexPts(50, 50, 28)}
                            fill="#c07020"
                            opacity="0.5"
                            stroke="none"
                        />
                    </svg>

                    <span>Occupied</span>
                </div>

                {/* Last update stamp */}
                <div className="ml-auto text-xs text-tertiary">
                    Updated{" "}
                    {map.lastUpdated
                        ? new Date(map.lastUpdated).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "—"}
                </div>
            </div>
        </div>
    );
};
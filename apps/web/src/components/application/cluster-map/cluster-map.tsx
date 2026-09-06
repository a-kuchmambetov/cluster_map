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
            {/* Summary showing free/occupied/total places */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-xl font-semibold sm:text-xl">
                    {map.cluster.label}
                </h2>
                {/* Free */}
                <div className="flex gap-5 sm:gap-7">
                    <div className="text-right">
                        <div className="text-lg font-bold text-success-primary sm:text-xl">
                            {map.summary.free}
                        </div>
                        <div className="text-xs text-tertiary">
                            free
                        </div>
                    </div>

                    {/* Occupied */}
                    <div className="text-right">
                        <div
                            className="text-lg font-bold sm:text-xl"
                            style={{ color: "#c07020" }}
                        >
                            {map.summary.occupied}
                        </div>
                        <div className="text-xs text-tertiary">
                            occupied
                        </div>
                    </div>
                    {/* Total */}
                    <div className="text-right">
                        <div className="text-lg font-bold text-tertiary sm:text-xl">
                            {map.summary.total}
                        </div>
                        <div className="text-xs text-tertiary">
                            total
                        </div>
                    </div>
                </div>
            </div>
            {/*Scrollable */}
            <div className="mt-6 overflow-x-auto">
                <div className="space-y-4">
                    {map.rows.map((row, index) => (
                        <ClusterRowView
                            key={row.id}
                            row={row}
                            clusterNumber={map.cluster.number}
                            rowIndex={index}
                            selectedPlaceId={selectedPlaceId}
                            onSelectPlace={handleSelectPlace}
                        />
                    ))}
                </div>
            </div>
            {/* Map legend, free/occupied */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                    <svg width="22" height="20" viewBox="0 0 22 20">
                        <polygon
                            points={hexPts(11, 10, 7)}
                            fill="#eaf5ec"
                            stroke="#2a8840"
                            strokeWidth="1.2"
                        />
                    </svg>

                    <span>Free</span>
                </div>

                <div className="flex items-center gap-2">
                    <svg width="22" height="20" viewBox="0 0 22 20">
                        <polygon
                            points={hexPts(11, 10, 7)}
                            fill="#fff2e0"
                            stroke="#c07020"
                            strokeWidth="1.2"
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
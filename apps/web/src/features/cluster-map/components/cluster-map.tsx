import { useEffect, useState } from "react";
import type { ClusterMapView } from "../model/cluster-map-view";
import { ClusterRowView } from "./cluster-row";
import { ClusterMapSummary } from "./cluster-map-summary";
import { ClusterMapNotices } from "./cluster-map-notices";
import { ClusterMapFooter } from "./cluster-map-footer";
import { useClusterMapLayout } from "../hooks/use-cluster-map-layout";

type ClusterMapProps = {
  map: ClusterMapView;
  refreshing?: boolean;
  stale?: boolean;
};

export const ClusterMap = ({
  map,
  refreshing = false,
  stale = false,
}: ClusterMapProps) => {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const {
    compactMobile,
    compactScale,
    canScrollHorizontally,
    clusterWidth,
    scrollContainerRef,
  } = useClusterMapLayout(map);

  useEffect(() => {
    setSelectedPlaceId(null);
  }, [map.cluster.number]);

  const handleClosePlace = () => {
    setSelectedPlaceId(null);
  };

  const handleSelectPlace = (placeId: string) => {
    setSelectedPlaceId((current) => (current === placeId ? null : placeId));
  };

  return (
    <div className="rounded-2xl border border-cluster-border bg-cluster-surface p-4 shadow-xs sm:p-5">
      {/* Cluster title + summary */}
      <ClusterMapSummary map={map} />

      {/* No free places banner and Map worning banner  */}
      <ClusterMapNotices map={map} />
      {/*Scrollable on mobile*/}
      {canScrollHorizontally && (
        <div className="mt-4 flex items-center justify-between sm:hidden">
          <span className="text-xs text-tertiary">
            Swipe to explore the cluster
          </span>

          <span className="text-xs text-tertiary" aria-hidden="true">
            ↔
          </span>
        </div>
      )}
      {/*Scrollable */}
      <div
        ref={scrollContainerRef}
        className="mt-2 overflow-x-auto overscroll-x-contain pb-2 sm:mt-5"
      >
        <div
          className="mx-auto"
          style={{
            width: `${clusterWidth + (compactMobile ? 1.5 : 3)}rem`,
          }}
        >
          {map.rows.map((row) => (
            <ClusterRowView
              key={row.id}
              row={row}
              clusterWidth={clusterWidth}
              compact={compactMobile}
              compactScale={compactScale}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={handleSelectPlace}
              onClosePlace={handleClosePlace}
            />
          ))}
        </div>
      </div>
      {/* Map legend, free/occupied */}
      <ClusterMapFooter map={map} refreshing={refreshing} stale={stale} />
    </div>
  );
};

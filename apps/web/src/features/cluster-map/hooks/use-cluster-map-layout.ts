import { useEffect, useRef, useState } from "react";
import type { ClusterMapView } from "../model/cluster-map-view";
import { getClusterRowWidth } from "../lib/cluster-row-layout";

const COMPACT_LABEL_GUTTER_REM = 1.5;
const COMPACT_MAX_SCALE = 1.8;
const COMPACT_MIN_SCALE = 0.8;
const COMPACT_SIDE_SPACE_REM = 0.35;

export const useClusterMapLayout = (map: ClusterMapView) => {
  const [compactMobile, setCompactMobile] = useState(false);
  const [compactScale, setCompactScale] = useState(1);
  const [canScrollHorizontally, setCanScrollHorizontally] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");

    const update = () => {
      setCompactMobile(media.matches);
    };

    update();
    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  const baseCompactClusterWidth = Math.max(
    ...map.rows.map((row) => getClusterRowWidth(row, true, 1)),
  );

  useEffect(() => {
    if (!compactMobile) {
      setCompactScale(1);
      return;
    }

    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const updateScale = () => {
      const rootFontSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      const availableWidthRem = container.clientWidth / rootFontSize;

      const usableWidthRem =
        availableWidthRem - COMPACT_LABEL_GUTTER_REM - COMPACT_SIDE_SPACE_REM;

      const scale = usableWidthRem / baseCompactClusterWidth;

      setCompactScale(
        Math.min(COMPACT_MAX_SCALE, Math.max(COMPACT_MIN_SCALE, scale)),
      );
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [compactMobile, baseCompactClusterWidth, map.cluster.number]);

  const clusterWidth = Math.max(
    ...map.rows.map((row) =>
      getClusterRowWidth(row, compactMobile, compactScale),
    ),
  );

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const updateScrollState = () => {
      setCanScrollHorizontally(
        container.scrollWidth > container.clientWidth + 1,
      );
    };

    updateScrollState();

    const observer = new ResizeObserver(updateScrollState);

    observer.observe(container);

    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }

    return () => {
      observer.disconnect();
    };
  }, [clusterWidth, map.cluster.number]);

  return {
    compactMobile,
    compactScale,
    canScrollHorizontally,
    clusterWidth,
    scrollContainerRef,
  };
};

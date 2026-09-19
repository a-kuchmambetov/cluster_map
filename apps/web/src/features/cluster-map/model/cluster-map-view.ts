import type {
  Cluster,
  LayoutGapCell,
  LayoutPlaceCell,
  Peer,
} from "@repo/types";

export type PlaceStatus = "free" | "occupied";

export type ClusterMapPlaceCell = LayoutPlaceCell & {
  status: PlaceStatus;
  peer: Peer | null;
};

export type ClusterMapCell = ClusterMapPlaceCell | LayoutGapCell;

export type ClusterMapRow = {
  id: string;
  number: number;
  label: string;
  cells: ClusterMapCell[];
};

export type ClusterMapSummary = {
  free: number;
  occupied: number;
  total: number;
};

export type ClusterMapWarning = {
  code: string;
  message: string;
};

export type ClusterMapView = {
  cluster: Cluster;
  rows: ClusterMapRow[];
  summary: ClusterMapSummary;
  lastUpdated: string | null;
  warnings: ClusterMapWarning[];
};

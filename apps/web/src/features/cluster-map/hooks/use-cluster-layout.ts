import { getClusterLayout } from "../api/cluster-map";
import { useClusterSnapshot } from "./use-cluster-snapshot";

export const useClusterLayout = (clusterNumber: number) =>
  useClusterSnapshot(clusterNumber, getClusterLayout);

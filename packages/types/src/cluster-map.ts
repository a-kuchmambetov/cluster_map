/**
 * Shared data structures for the Cluster Map API.
 */

/**
 * Minimal peer information exposed by the API.
 */
export interface Peer {
    intraName: string | null;
    displayName: string | null;
    photo: string | null;
}

/**
 * Basic information identifying a cluster.
 */
export type Cluster = {
    id: string;
    number: number;
    label: string;
};

/**
 * Response returned by:
 *
 * GET /api/clusters
 */
export type ClusterListResponse = {
    clusters: Cluster[];
};

/**
 * Vertical position of a place inside a staggered cluster row.
 */
export type Position = "top" | "bottom";

/**
 * A real place returned by:
 *
 * GET /api/clusters/:clusterNumber/layout
 *
 * `position` is optional. If it is omitted, the frontend continues
 * the alternating top/bottom pattern from the preceding place.
 */
export type LayoutPlaceCell = {
    kind: "place";
    id: string;
    number: number;
    position?: Position;
};

/**
 * A visual spacer in the physical layout.
 */
export type LayoutGapCell = {
    kind: "gap";
};

/**
 * A cell in a layout row can be either a real place or a gap.
 */
export type LayoutCell = LayoutPlaceCell | LayoutGapCell;

/**
 * One physical row returned by GET /layout.
 *
 * Cells are returned in their physical order.
 */
export type ClusterLayoutRow = {
    id: string;
    number: number;
    label: string;
    cells: LayoutCell[];
};

/**
 * Response returned by:
 *
 * GET /api/clusters/:clusterNumber/layout
 */
export type ClusterLayoutResponse = {
    cluster: Cluster;
    rows: ClusterLayoutRow[];
};

/**
 * One currently occupied place returned by GET /occupancy.
 *
 * Layout and occupancy are joined by:
 * row number + place number.
 */
export type OccupiedEntry = {
    row: number;
    place: number;
    peer: Peer;
};

/**
 * Response returned by:
 *
 * GET /api/clusters/:clusterNumber/occupancy
 *
 * Places missing from `occupied` are considered free.
 */
export type ClusterOccupancyResponse = {
    occupied: OccupiedEntry[];
    lastUpdated: string | null;
};

/**
 * One validation problem found in a cluster configuration.
 */
export type ConfigValidationError = {
    code: string;
    message: string;
    path: string;
};

/**
 * Response returned by:
 *
 * GET /api/clusters/:clusterNumber/config-validation
 */
export type ConfigValidationResponse = {
    clusterNumber: number;
    valid: boolean;
    errors: ConfigValidationError[];
};

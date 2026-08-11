/**
 * Shared data structs for the cluster map api
 */


/**
 * Represents the current state of a real place in a cluster.
 *
 * "free"     -> nobody is currently occupying the place
 * "occupied" -> a peer is associated with the place
 *
 * This comes directly from the API contract.
 * The frontend does not need to infer the status from whether `peer` exists.
 */
export type PlaceStatus = "free" | "occupied";

/**
 * Minimal information about a peer displayed on an occupied place.
 *
 * The API intentionally exposes only the information approved
 * for the Cluster Map. We should not expect email, photo, etc.
 */
export type Peer = {
    intraName: string;
    displayName: string | null;
};
/**
 * A real, numbered place in the cluster layout.
 *
 * `kind: "place"` allows TypeScript to distinguish this from a gap
 * when working with the MapCell union below.
 *
 * `peer` is null when the place is free.
 */
export type PlaceCell = {
    kind: "place";
    id: string;
    number: number;
    status: PlaceStatus;
    peer: Peer | null;
};
/**
 * A visual gap in the physical layout.
 *
 * A gap is not a real place, so it has no number and cannot be occupied.
 * The frontend should render it as empty space without interaction.
 */
export type GapCell = {
    kind: "gap";
};
/**
 * A cell in a row can be either a real place or a layout gap.
 *
 * This is a discriminated union: `kind` tells TypeScript which
 * type of cell we are dealing with.
 *
 * Example:
 *
 * if (cell.kind === "place") {
 *     // cell is PlaceCell
 * } else {
 *     // cell is GapCell
 * }
 */
export type MapCell = PlaceCell | GapCell;

/**
 * Basic information identifying a cluster.
 *
 * Used both by the cluster picker and by the map response.
 */
export type Cluster = {
    id: string;
    number: number;
    label: string;
};
/**
 * A row inside a cluster.
 *
 * `cells` contains places and gaps in their physical order.
 * The frontend should render the cells in this order.
 */

export type ClusterRow = {
    id: string;
    number: number;
    label: string;
    cells: MapCell[];
};
/**
 * Pre-calculated availability information returned by the API.
 *
 * The API calculates these values so the frontend does not need
 * to count free/occupied places itself.
 *
 * `total` does not include layout gaps.
 */
export type ClusterMapSummary = {
    free: number;
    occupied: number;
    total: number;
};
/**
 * A non-fatal problem encountered while building the map.
 *
 * For example, occupancy data may reference a place that does not
 * exist in the layout configuration.
 *
 * The API keeps the valid map data and reports the problem here.
 */
export type MapWarning = {
    code: string;
    message: string;
};
/**
 * Complete response returned by:
 *
 * GET /api/clusters/:clusterNumber/map
 *
 * This is the main data structure the frontend will use to render
 * the Cluster Map.
 */
export type ClusterMapResponse = {
    cluster: Cluster;
    rows: ClusterRow[];
    summary: ClusterMapSummary;
    lastUpdated: string | null;
    warnings: MapWarning[];
};
/**
 * Response returned by:
 *
 * GET /api/clusters
 *
 * Used by the frontend to populate the cluster selector.
 */
export type ClusterListResponse = {
    clusters: Cluster[];
};

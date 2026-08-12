import type {
    ClusterListResponse,
    ClusterMapResponse,
} from "@repo/types";

// Fake response for GET /api/clusters
export const mockClusters: ClusterListResponse = {
    clusters: [
        {
            id: "c1",
            number: 1,
            label: "Cluster 1",
        },
        {
            id: "c2",
            number: 2,
            label: "Cluster 2",
        },
    ],
};

// Fake response for GET /api/clusters/:clusterNumber/map
export const mockClusterMap: ClusterMapResponse = {
    cluster: {
        id: "c1",
        number: 1,
        label: "Cluster 1",
    },

    rows: [
        {
            id: "c1r1",
            number: 1,
            label: "Row 1",
            cells: [
                {
                    kind: "place",
                    id: "c1r1p1",
                    number: 1,
                    status: "free",
                    peer: null,
                },
                {
                    kind: "place",
                    id: "c1r1p2",
                    number: 2,
                    status: "occupied",
                    peer: {
                        intraName: "jdoe",
                        displayName: "John Doe",
                    },
                },
                {
                    kind: "gap",
                },
                {
                    kind: "place",
                    id: "c1r1p3",
                    number: 3,
                    status: "free",
                    peer: null,
                },
            ],
        },
        {
            id: "c1r2",
            number: 2,
            label: "Row 2",
            cells: [
                {
                    kind: "place",
                    id: "c1r2p1",
                    number: 1,
                    status: "occupied",
                    peer: {
                        intraName: "asmith",
                        displayName: "Alice Smith",
                    },
                },
                {
                    kind: "place",
                    id: "c1r2p2",
                    number: 2,
                    status: "free",
                    peer: null,
                },
                {
                    kind: "gap",
                },
                {
                    kind: "place",
                    id: "c1r2p3",
                    number: 3,
                    status: "free",
                    peer: null,
                },
            ],
        },
    ],

    summary: {
        free: 4,
        occupied: 2,
        total: 6,
    },

    lastUpdated: "2026-08-12T08:55:00Z",

    warnings: [],
};

import type {
    ClusterLayoutResponse,
    ClusterListResponse,
    ClusterOccupancyResponse,
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




export const mockClusterLayouts: Record<
    number,
    ClusterLayoutResponse
> = {
    1: {
        cluster: {
            id: "c1",
            number: 1,
            label: "Cluster 1",
        },
        rows: [
            {
                id: "c1r2",
                number: 2,
                label: "Row 2",
                cells: [
                    {
                        kind: "place",
                        id: "c1r2p1",
                        number: 1,
                        position: "bottom",
                    },
                    {
                        kind: "place",
                        id: "c1r2p2",
                        number: 2,
                    },
                    {
                        kind: "gap",
                    },
                    {
                        kind: "place",
                        id: "c1r2p3",
                        number: 3,
                    },
                ],
            },
            {
                id: "c1r1",
                number: 1,
                label: "Row 1",
                cells: [
                    {
                        kind: "place",
                        id: "c1r1p1",
                        number: 1,
                        position: "bottom",
                    },
                    {
                        kind: "place",
                        id: "c1r1p2",
                        number: 2,
                    },
                    {
                        kind: "gap",
                    },
                    {
                        kind: "place",
                        id: "c1r1p3",
                        number: 3,
                    },
                    {
                        kind: "place",
                        id: "c1r1p4",
                        number: 4,
                    },
                ],
            },
        ],
    },

    2: {
        cluster: {
            id: "c2",
            number: 2,
            label: "Cluster 2",
        },
        rows: [
            {
                id: "c2r2",
                number: 2,
                label: "Row 2",
                cells: [
                    {
                        kind: "place",
                        id: "c2r2p1",
                        number: 1,
                        position: "bottom",
                    },
                    {
                        kind: "place",
                        id: "c2r2p2",
                        number: 2,
                    },
                ],
            },
            {
                id: "c2r1",
                number: 1,
                label: "Row 1",
                cells: [
                    {
                        kind: "place",
                        id: "c2r1p1",
                        number: 1,
                        position: "bottom",
                    },
                    {
                        kind: "gap",
                    },
                    {
                        kind: "place",
                        id: "c2r1p2",
                        number: 2,
                    },
                ],
            },
        ],
    },
};



export const mockClusterOccupancies: Record<
    number,
    ClusterOccupancyResponse
> = {
    1: {
        occupied: [
            {
                row: 1,
                place: 2,
                peer: {
                    intraName: "jdoe",
                    displayName: "John Doe",
                    photo: null,
                },
            },
            {
                row: 2,
                place: 1,
                peer: {
                    intraName: "asmith",
                    displayName: "Alice Smith",
                    photo: null,
                },
            },
        ],
        lastUpdated: "2026-09-12T18:00:00Z",
    },

    2: {
        occupied: [
            {
                row: 1,
                place: 1,
                peer: {
                    intraName: "mjohnson",
                    displayName: "Mike Johnson",
                    photo: null,
                },
            },
            {
                row: 2,
                place: 2,
                peer: {
                    intraName: "slee",
                    displayName: "Sarah Lee",
                    photo: null,
                },
            },
        ],
        lastUpdated: "2026-09-12T18:00:00Z",
    },
};
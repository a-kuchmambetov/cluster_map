// Dusty blue + muted terracotta + soft navy selector

export const clusterPlaceStyles = {
    free: {
        idle: {
            fill: "var(--color-cluster-free-fill)",
            stroke: "var(--color-cluster-free-stroke)",
            text: "var(--color-cluster-free-text)",
        },

        hover: {
            fill: "var(--color-cluster-free-hover-fill)",
            stroke: "var(--color-cluster-free-hover-stroke)",
            text: "var(--color-cluster-free-hover-text)",
        },
    },

    occupied: {
        idle: {
            fill: "var(--color-cluster-occupied-fill)",
            stroke: "var(--color-cluster-occupied-stroke)",
            text: "var(--color-cluster-occupied-text)",
        },

        hover: {
            fill: "var(--color-cluster-occupied-hover-fill)",
            stroke: "var(--color-cluster-occupied-hover-stroke)",
            text: "var(--color-cluster-occupied-hover-text)",
        },
    },

    selected: {
        fill: "var(--color-cluster-selected-fill)",
        stroke: "var(--color-cluster-selected-stroke)",
        text: "var(--color-cluster-selected-text)",
    },
} as const;
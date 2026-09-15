export const clusterPlaceStyles = {
    free: {
        idle: {
            fill: "#eef7f0",
            stroke: "#4f8f5d",
            text: "#2f6f3d",
        },

        hover: {
            fill: "#dfeee2",
            stroke: "#3f7f4f",
            text: "#245d32",
        },
    },

    occupied: {
        idle: {
            fill: "#fff4e8",
            stroke: "#c47a2c",
            text: "#8f5418",
        },

        hover: {
            fill: "#ffe7cc",
            stroke: "#b9681f",
            text: "#7f4713",
        },
    },

    selected: {
        fill: "#ffe3ad",
        stroke: "#d88a16",
        text: "#765000",
    },
} as const;
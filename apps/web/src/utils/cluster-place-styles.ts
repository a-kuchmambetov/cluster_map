export const clusterPlaceStyles = {
    free: {
        idle: {
            fill: "#eaf5ec",
            stroke: "#2a8840",
            text: "#196a28",
        },

        hover: {
            fill: "#d4efda",
            stroke: "#1ea040",
            text: "#148032",
        },
    },

    occupied: {
        idle: {
            fill: "#fff2e0",
            stroke: "#c07020",
            text: "#8a5010",
        },

        hover: {
            fill: "#ffe6c0",
            stroke: "#d88030",
            text: "#a06018",
        },
    },

    selected: {
        fill: "#ffe0a0",
        stroke: "#e09000",
        text: "#806000",
    },
} as const;
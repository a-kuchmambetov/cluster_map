export type Group = [
    firstPlace: number,
    count: number,
    colStart: number,
];

export type RowLayout = Group[];

export const CLUSTER_LAYOUTS: Record<number, RowLayout[]> = {
    1: [
        [[1, 8, 0], [9, 3, 5.5]],
        [[1, 2, 0], [3, 4, 2.5]],
        [[1, 5, 0], [6, 4, 4.0]],
        [[1, 8, 0], [9, 3, 5.5]],
        [[1, 9, 0], [10, 12, 6.0]],
        [[1, 9, 0], [10, 12, 6.0]],
    ],

    2: [
        [[1, 8, 0], [9, 5, 5.5]],
        [[1, 13, 0]],
        [[1, 13, 0]],
        [[1, 8, 0], [9, 5, 5.5]],
        [[1, 13, 0]],
        [[1, 13, 0]],
    ],

    3: [
        [[1, 7, 0]],
        [[1, 7, 0]],
        [[1, 7, 0]],
        [[1, 8, 0]],
        [[1, 7, 0]],
    ],
};

export const getPlacePosition = (
    clusterNumber: number,
    rowIndex: number,
    placeNumber: number,
) => {
    const layout = CLUSTER_LAYOUTS[clusterNumber]?.[rowIndex];

    if (!layout) {
        return null;
    }

    for (const [firstPlace, count, colStart] of layout) {
        const lastPlace = firstPlace + count - 1;

        if (
            placeNumber >= firstPlace &&
            placeNumber <= lastPlace
        ) {
            const offset = placeNumber - firstPlace;

            return {
                column: colStart + offset,
                row: placeNumber % 2 === 0 ? 0 : 1,
            };
        }
    }

    return null;
};
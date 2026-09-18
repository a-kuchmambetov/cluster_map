import type { OccupancyDelta, OccupiedEntry, } from "@repo/types";

const entryKey = (
    entry: Pick<OccupiedEntry, "row" | "place">,
): string => `${entry.row}:${entry.place}`;

/**
 * Applies an SSE occupancy delta to the current occupied places.
 *
 * Freed places are removed first.
 * Occupied entries are then added or replaced using row + place
 * as the unique key.
 */
export const applyOccupancyDelta = (
    current: OccupiedEntry[],
    delta: OccupancyDelta,
): OccupiedEntry[] => {
    const next = new Map(
        current.map((entry) => [entryKey(entry), entry]),
    );

    for (const freed of delta.freed) {
        next.delete(entryKey(freed));
    }

    for (const occupied of delta.occupied) {
        next.set(entryKey(occupied), occupied);
    }

    return Array.from(next.values());
};
export function hexPts(cx: number, cy: number, r: number): string {
    return Array.from({ length: 6 }, (_, k) => {
        const angle = (k * Math.PI) / 3 - Math.PI / 2;

        return `${(
            cx + r * Math.cos(angle)
        ).toFixed(1)},${(
            cy + r * Math.sin(angle)
        ).toFixed(1)}`;
    }).join(" ");
}

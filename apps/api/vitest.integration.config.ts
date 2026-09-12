import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/test/integration/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
    },
    resolve: {
        alias: {
            "@middleware": path.resolve(__dirname, "./src/middleware"),
            "@features": path.resolve(__dirname, "./src/features"),
            "@config": path.resolve(__dirname, "./src/config"),
        },
    },
});

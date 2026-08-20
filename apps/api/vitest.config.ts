import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
    },
    resolve: {
        alias: {
            "@middleware": path.resolve(__dirname, "./src/middleware"),
            "@features": path.resolve(__dirname, "./src/features"),
            "@config": path.resolve(__dirname, "./src/config"),
        },
    },
});

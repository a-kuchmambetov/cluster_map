import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/src/test/integration/**"],
  },
  resolve: {
    alias: {
      "@middleware": fileURLToPath(
        new URL("./src/middleware", import.meta.url),
      ),
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@config": fileURLToPath(new URL("./src/config", import.meta.url)),
    },
  },
});

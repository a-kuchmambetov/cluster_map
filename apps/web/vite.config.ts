import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    envDir: fileURLToPath(new URL("../../", import.meta.url)),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

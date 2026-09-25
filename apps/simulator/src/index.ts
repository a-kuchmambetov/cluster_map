import { env } from "./env.js";
import { startSimulator } from "./simulator.js";

if (!env.SIMULATOR_ENABLED) {
  console.log("SIMULATOR_ENABLED is not true. Exiting.");
  process.exit(0);
}

if (process.env.NODE_ENV === "production") {
  console.error("Simulator is disabled in production.");
  process.exit(1);
}

const { stop } = startSimulator();

const shutdown = (signal: string): void => {
  console.log(`[simulator] received ${signal}, stopping...`);
  stop()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[simulator] shutdown failed", error);
      process.exit(1);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

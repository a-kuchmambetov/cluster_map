import { createLogger } from "../../src/logger.js";

export function captureLogs() {
  const entries: Array<Record<string, unknown>> = [];
  const logger = createLogger(
    {},
    {
      write(line) {
        entries.push(JSON.parse(line));
      },
    },
  );
  return { logger, entries };
}

import pino, { type DestinationStream, type Logger } from "pino";

export type AppLogger = Pick<
  Logger,
  "info" | "warn" | "error" | "fatal" | "flush"
>;

// Deliberately omit messages, stacks, causes and driver metadata: they can contain
// SQL parameters, OAuth codes, cookies, or credentials with arbitrary encodings.
export function safeError(error: unknown): { type: string; code?: string } {
  let current = error;
  let code: string | undefined;
  const types = ["Error", "TypeError", "SyntaxError", "AbortError", "AppError"];
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const candidate = "code" in current ? current.code : undefined;
    if (
      typeof candidate === "string" &&
      /^(?:[0-9A-Z]{5}|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE)$/.test(
        candidate,
      )
    )
      code = candidate;
    current = current.cause;
  }
  return {
    type:
      error instanceof Error && types.includes(error.name)
        ? error.name
        : "Error",
    ...(code ? { code } : {}),
  };
}

export function safePath(url: string): string {
  let path = url.split("?")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    return "[INVALID_PATH]";
  }
  const sanitized = path
    .replace(/\/{2,}/g, "/")
    .replace(/(\/api\/auth\/confirm\/).*/i, "$1[REDACTED]")
    .replace(/(\/api\/admin\/users\/).*/i, "$1[REDACTED]")
    .slice(0, 512);
  // Control bytes must never create forged log lines.
  return Array.from(sanitized, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? "_" : character;
  }).join("");
}

// An allowlist is safer than trying to enumerate every secret-bearing nested key.
// All call sites use static events and these small, explicit diagnostic fields.
const fields = new Set([
  "event",
  "requestId",
  "method",
  "path",
  "statusCode",
  "durationMs",
  "errorCode",
  "signal",
  "timeoutMs",
  "phase",
  "port",
  "forced",
  "outcome",
  "elapsedMs",
  "exitCode",
]);
export function createLogger(
  options: { LOG_LEVEL?: string } = {},
  destination: DestinationStream = pino.destination({ dest: 1, sync: true }),
): AppLogger {
  return pino(
    {
      level: options.LOG_LEVEL ?? "info",
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      hooks: {
        logMethod(args, method) {
          const input = args[0];
          const output: Record<string, unknown> = {};
          if (input && typeof input === "object") {
            for (const [key, value] of Object.entries(input)) {
              if (key === "diagnostic") output.diagnostic = safeError(value);
              else if (
                fields.has(key) &&
                ["string", "number", "boolean"].includes(typeof value)
              )
                output[key] = value;
            }
          }
          method.call(this, output);
        },
      },
    },
    destination,
  );
}

// Factories without a logger stay silent and never read process environment.
export const silentLogger: AppLogger = pino({ enabled: false });
export function flushLogger(logger: AppLogger): Promise<void> {
  return new Promise((resolve, reject) =>
    logger.flush((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    }),
  );
}

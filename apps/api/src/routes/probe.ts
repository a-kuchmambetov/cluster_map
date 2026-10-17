import { type AppLogger, silentLogger } from "../logger.js";
import type { Runtime } from "../lifecycle/runtime.js";

export function createBoundedProbe(
  execute: (signal: AbortSignal) => Promise<unknown>,
  timeoutMs: number,
  event: string,
  logger: AppLogger = silentLogger,
  runtime?: Runtime,
) {
  let active: Promise<boolean> | undefined;
  let unsettled = false;
  return (): Promise<boolean> => {
    if (runtime?.draining) return Promise.resolve(false);
    if (active) return active;
    // A misbehaving injected executor that ignores cancellation cannot spawn
    // more work on subsequent probes. Production destroys its dedicated client.
    if (unsettled) return Promise.resolve(false);
    unsettled = true;
    const controller = new AbortController();
    const abort = () => controller.abort();
    runtime?.signal.addEventListener("abort", abort, { once: true });
    let timer: NodeJS.Timeout | undefined;
    const startedAt = Date.now();
    const work = Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return execute(controller.signal);
      })
      .finally(() => {
        unsettled = false;
      });
    runtime?.track(work);
    active = (async () => {
      try {
        await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new DOMException("Probe aborted", "AbortError")),
              { once: true },
            );
            timer = setTimeout(abort, timeoutMs);
          }),
        ]);
        return !controller.signal.aborted;
      } catch (diagnostic) {
        logger.warn({
          event,
          elapsedMs: Date.now() - startedAt,
          timeoutMs,
          diagnostic,
        });
        return false;
      } finally {
        clearTimeout(timer);
        runtime?.signal.removeEventListener("abort", abort);
        active = undefined;
      }
    })();
    return active;
  };
}

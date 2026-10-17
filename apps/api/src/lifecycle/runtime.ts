export type Runtime = ReturnType<typeof createRuntime>;

// Owns background work started by this API instance, including disconnected SSE
// revalidations and polls. Draining is synchronous; settlement is awaited later.
export function createRuntime() {
  const controller = new AbortController();
  const cleanups = new Set<() => void>();
  const tasks = new Set<Promise<unknown>>();
  return {
    get draining() {
      return controller.signal.aborted;
    },
    signal: controller.signal,
    onDrain(cleanup: () => void): () => void {
      if (controller.signal.aborted) {
        cleanup();
        return () => {};
      }
      cleanups.add(cleanup);
      return () => {
        cleanups.delete(cleanup);
      };
    },
    track<T>(task: Promise<T>): Promise<T> {
      tasks.add(task);
      void task.then(
        () => tasks.delete(task),
        () => tasks.delete(task),
      );
      return task;
    },
    beginDrain() {
      if (controller.signal.aborted) return;
      controller.abort();
      const failures: unknown[] = [];
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (error) {
          failures.push(error);
        }
      }
      cleanups.clear();
      if (failures.length)
        throw new AggregateError(failures, "Runtime cleanup failed");
    },
    async whenIdle() {
      // Drain may remove the last subscriber while its poll is still settling.
      // eslint-disable-next-line no-await-in-loop
      while (tasks.size) await Promise.allSettled(tasks);
    },
  };
}

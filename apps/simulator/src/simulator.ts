import { db } from "@repo/db";
import type { PoolClient } from "pg";
import {
  chooseAction,
  claimSeat,
  loadSimulatorState,
  releaseSeat,
} from "./actions.js";
import { env } from "./env.js";
import { ensureSimulatorIdentities } from "./identities.js";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "./lock.js";

export async function tick(simIds: string[]): Promise<void> {
  const state = await loadSimulatorState(simIds);
  const action = chooseAction(
    state,
    env.SIMULATOR_CLAIM_PROBABILITY,
    env.SIMULATOR_RELEASE_PROBABILITY,
  );

  if (action.type === "claim") {
    await claimSeat(action.positionId, action.userId);
    console.log(
      `[simulator] claimed position ${action.positionId} for ${action.userId}`,
    );
  } else if (action.type === "release") {
    await releaseSeat(action.positionId, action.holderId);
    console.log(`[simulator] released position ${action.positionId}`);
  } else {
    console.log("[simulator] no action this tick");
  }
}

export function startSimulator(): { stop: () => Promise<void> } {
  let lockClient: PoolClient | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopping = false;

  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;

    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }

    if (lockClient) {
      await releaseAdvisoryLock(lockClient, env.SIMULATOR_LOCK_KEY).catch(
        (error) => {
          console.error("[simulator] failed to release advisory lock", error);
        },
      );
      lockClient = undefined;
    }

    await db.$client.end().catch(() => {});
  };

  const run = async (): Promise<void> => {
    lockClient = await acquireAdvisoryLock(env.SIMULATOR_LOCK_KEY);
    console.log(`[simulator] acquired advisory lock ${env.SIMULATOR_LOCK_KEY}`);

    const simIds = await ensureSimulatorIdentities(env.SIMULATOR_USER_COUNT);
    console.log(`[simulator] ${simIds.length} synthetic identities ready`);

    if (simIds.length === 0) {
      throw new Error("No simulator identities available.");
    }

    await tick(simIds);

    timer = setInterval(() => {
      void tick(simIds).catch((error) => {
        console.error("[simulator] tick failed", error);
      });
    }, env.SIMULATOR_INTERVAL_MS);
  };

  void run().catch(async (error) => {
    console.error("[simulator] failed to start", error);
    await stop();
    process.exitCode = 1;
  });

  return { stop };
}

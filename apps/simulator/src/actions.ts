import { and, db, eq, position } from "@repo/db";
import type { SimulatorAction, SimulatorState } from "./types.js";

export async function loadSimulatorState(
  simIds: string[],
): Promise<SimulatorState> {
  const seatedRows = await db
    .select({
      positionId: position.id,
      rowId: position.rowId,
      seatNumber: position.seatNumber,
      holderId: position.holderId,
    })
    .from(position)
    .where(eq(position.occupied, true));

  const seated = seatedRows
    .filter((row) => row.holderId !== null && simIds.includes(row.holderId))
    .map((row) => ({
      positionId: row.positionId,
      rowId: row.rowId,
      seatNumber: row.seatNumber,
      holderId: row.holderId!,
    }));

  const seatedIds = new Set(seated.map((row) => row.holderId));
  const idleIds = simIds.filter((id) => !seatedIds.has(id));

  const freeSeats = await db
    .select({
      positionId: position.id,
      rowId: position.rowId,
      seatNumber: position.seatNumber,
    })
    .from(position)
    .where(eq(position.occupied, false));

  return { seated, idleIds, freeSeats };
}

export async function claimSeat(
  positionId: number,
  userId: string,
): Promise<void> {
  await db
    .update(position)
    .set({
      occupied: true,
      holderId: userId,
      takenAt: new Date(),
    })
    .where(and(eq(position.id, positionId), eq(position.occupied, false)));
}

export async function releaseSeat(
  positionId: number,
  holderId: string,
): Promise<void> {
  await db
    .update(position)
    .set({
      occupied: false,
      holderId: null,
      takenAt: null,
    })
    .where(and(eq(position.id, positionId), eq(position.holderId, holderId)));
}

export function chooseAction(
  state: SimulatorState,
  claimProbability: number,
  releaseProbability: number,
  rng = Math.random,
): SimulatorAction {
  if (state.seated.length > 0 && rng() < releaseProbability) {
    const seat = state.seated[Math.floor(rng() * state.seated.length)]!;
    return {
      type: "release",
      positionId: seat.positionId,
      holderId: seat.holderId,
    };
  }

  if (
    state.idleIds.length > 0 &&
    state.freeSeats.length > 0 &&
    rng() < claimProbability
  ) {
    const seat = state.freeSeats[Math.floor(rng() * state.freeSeats.length)]!;
    const userId = state.idleIds[Math.floor(rng() * state.idleIds.length)]!;
    return { type: "claim", positionId: seat.positionId, userId };
  }

  return { type: "noop" };
}

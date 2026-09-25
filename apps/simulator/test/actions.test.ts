import { describe, expect, it, vi } from "vitest";
import type { SimulatorState } from "../src/types.js";

vi.mock("@repo/db", () => ({
  db: {},
  position: {},
  eq: () => ({}),
  and: () => ({}),
  inArray: () => ({}),
}));

import { chooseAction } from "../src/actions.js";

describe("chooseAction", () => {
  const baseState: SimulatorState = {
    seated: [{ positionId: 1, rowId: 10, seatNumber: 5, holderId: "u1" }],
    idleIds: ["u2"],
    freeSeats: [{ positionId: 2, rowId: 10, seatNumber: 6 }],
  };

  it("releases a seated simulator seat when rng is below release probability", () => {
    const rng = vi.fn().mockReturnValueOnce(0.2).mockReturnValueOnce(0);
    const action = chooseAction(baseState, 0.5, 0.3, rng);
    expect(action).toEqual({
      type: "release",
      positionId: 1,
      holderId: "u1",
    });
  });

  it("claims a free seat when release is not triggered and rng is below claim probability", () => {
    const rng = vi
      .fn()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);
    const action = chooseAction(baseState, 0.7, 0.3, rng);
    expect(action).toEqual({
      type: "claim",
      positionId: 2,
      userId: "u2",
    });
  });

  it("does nothing when probabilities are not met", () => {
    const rng = vi.fn().mockReturnValue(0.99);
    const action = chooseAction(baseState, 0.1, 0.1, rng);
    expect(action).toEqual({ type: "noop" });
  });

  it("does nothing when there are no free seats and no seated sim users", () => {
    const state: SimulatorState = {
      seated: [],
      idleIds: ["u2"],
      freeSeats: [],
    };
    const action = chooseAction(state, 1, 1, Math.random);
    expect(action).toEqual({ type: "noop" });
  });

  it("does nothing when all identities are seated and no free seats exist", () => {
    const state: SimulatorState = {
      seated: [{ positionId: 1, rowId: 10, seatNumber: 5, holderId: "u1" }],
      idleIds: [],
      freeSeats: [],
    };
    const action = chooseAction(state, 1, 0, Math.random);
    expect(action).toEqual({ type: "noop" });
  });
});

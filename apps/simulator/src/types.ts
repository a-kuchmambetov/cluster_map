export type SeatedSeat = {
  positionId: number;
  rowId: number;
  seatNumber: number;
  holderId: string;
};

export type FreeSeat = {
  positionId: number;
  rowId: number;
  seatNumber: number;
};

export type SimulatorState = {
  seated: SeatedSeat[];
  idleIds: string[];
  freeSeats: FreeSeat[];
};

export type SimulatorAction =
  | { type: "release"; positionId: number; holderId: string }
  | { type: "claim"; positionId: number; userId: string }
  | { type: "noop" };

export const orientations = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export type Orientation = (typeof orientations)[number];

export type Coordinate = [number, number];
export type Player = "RED" | "BLUE";

export type Square = {
  type: UnitType;
  player: Player;
  orientation?: Orientation;
} | null;

export type NonNullSquare = Exclude<Square, null>;

export type UnitType = keyof typeof Units;

export const Units: {
  [key: string]: {
    mobility: 1 | 2;
    canCapture: boolean;
    artilleryRange?: number;
    canParachute?: true;
    imagePathPrefix: string;
  };
} = {
  HQ: { mobility: 1, canCapture: false, imagePathPrefix: "hq" },
  INFANTRY: {
    mobility: 1,
    canCapture: true,
    imagePathPrefix: "regular-infantry",
  },
  ARMORED_INFANTRY: {
    mobility: 2,
    canCapture: true,
    imagePathPrefix: "armored-infantry",
  },
  AIRBORNE_INFANTRY: {
    mobility: 1,
    canCapture: true,
    canParachute: true,
    imagePathPrefix: "paratrooper-infantry",
  },
  ARTILLERY: {
    mobility: 1,
    artilleryRange: 2,
    canCapture: false,
    imagePathPrefix: "regular-artillery",
  },
  ARMORED_ARTILLERY: {
    mobility: 2,
    artilleryRange: 2,
    canCapture: false,
    imagePathPrefix: "armored-artillery",
  },
  HEAVY_ARTILLERY: {
    mobility: 1,
    artilleryRange: 3,
    canCapture: false,
    imagePathPrefix: "heavy-artillery",
  },
};

export type ReserveFleet = {
  INFANTRY: number;
  ARMORED_INFANTRY: number;
  AIRBORNE_INFANTRY: number;
  ARTILLERY: number;
  ARMORED_ARTILLERY: number;
  HEAVY_ARTILLERY: number;
};

export type Board = [
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square],
  [Square, Square, Square, Square, Square, Square, Square, Square]
];

export type AllowedMove =
  | ReinforceMove
  | MoveMove
  | MoveAndOrientMove
  | AutoCaptureMove
  | SkipMove;

export interface ReinforceMove {
  name: "Reinforce";
  args: [
    unitType: keyof ReserveFleet,
    to: Coordinate,
    capturePreference?: Coordinate
  ];
}

export interface MoveMove {
  name: "Move";
  args: [from: Coordinate, to: Coordinate, capturePreference?: Coordinate];
}

export interface MoveAndOrientMove {
  name: "MoveAndOrient";
  args: [from: Coordinate, to: Coordinate, orientation?: Orientation];
}

export interface AutoCaptureMove {
  name: "AutoCapture";
  args: [autoCaptureType: "bombard" | "free", capturePreference: Coordinate];
}

export interface SkipMove {
  name: "Skip";
  args: [];
}

export interface GameState {
  board: Board;
  currentPlayer: Player;
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;
  thisTurnMoves: AllowedMove[];
  lastPlayerMoves: AllowedMove[];
  gameOver: boolean;
  winner?: Player;
  eval: number;
}

export interface GameoverState {
  status: "WIN" | "DRAW";
  winner?: Player;
  reason: string;
}

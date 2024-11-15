import type { Ctx, FnContext, Game, Move } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";

import {
  clearBombardedSquares,
  freeInfantryCaptures,
} from "@/game/capture-logic";
import { appendHistory, HistoryPlugin } from "./move-history-plugin";
import { getGameoverState } from "./gameover-logic";
import { isMoveAllowed } from "./board-moves";
import { calculateEval } from "./eval";
import { ai } from "./ai";

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

export type UnitType = keyof typeof Units;

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

export type ReserveFleet = {
  INFANTRY: number;
  ARMORED_INFANTRY: number;
  AIRBORNE_INFANTRY: number;
  ARTILLERY: number;
  ARMORED_ARTILLERY: number;
  HEAVY_ARTILLERY: number;
};

export type AllowedMove =
  | ReinforceMove
  | MoveMove
  | MoveAndOrientMove
  | SkipMove;

export interface ReinforceMove {
  name: "Reinforce";
  args: [unitType: keyof ReserveFleet, to: Coordinate];
}

export interface MoveMove {
  name: "Move";
  args: [from: Coordinate, to: Coordinate, capturePreference?: Coordinate];
}

export interface MoveAndOrientMove {
  name: "MoveAndOrient";
  args: [from: Coordinate, to: Coordinate, orientation?: Orientation];
}

export interface SkipMove {
  name: "Skip";
  args: [];
}

export interface GHQState {
  isOnline?: boolean;
  isReplayMode?: boolean;
  matchId: string;
  userIds: {
    "0": string;
    "1": string;
  };
  elos: {
    "0": number;
    "1": number;
  };
  board: [
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square]
  ];
  redTurnStartBoard: [
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square]
  ];
  blueTurnStartBoard: [
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square],
    [Square, Square, Square, Square, Square, Square, Square, Square]
  ];
  lastPlayerMoves: AllowedMove[];
  thisTurnMoves: AllowedMove[];
  eval: number;
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;
  // time control
  redElapsed: number;
  blueElapsed: number;
  timeControl: number;
  bonusTime: number;
  startTime: number;
  turnStartTime: number;
  // draw state
  drawOfferedBy?: string;
  drawAcceptedBy?: string;
  // displaying moves from most recent turn
  lastTurnMoves: Record<"0" | "1", Coordinate[]>;
  lastTurnCaptures: Record<"0" | "1", Coordinate[]>;
}

export interface GameoverState {
  status: "WIN" | "DRAW";
  winner?: Player;
  reason: string;
}

const Reinforce: Move<GHQState> = (
  { G, ctx },
  unitType: keyof ReserveFleet,
  to: Coordinate
) => {
  const reserve = ctx.currentPlayer === "0" ? G.redReserve : G.blueReserve;
  if (
    !G.isReplayMode &&
    !isMoveAllowed(G, ctx, {
      name: "Reinforce",
      args: [unitType, to],
    })
  ) {
    return INVALID_MOVE;
  }

  if (reserve[unitType] === 0) {
    return INVALID_MOVE;
  }

  // decrement reserves
  reserve[unitType]--;

  if (ctx.currentPlayer === "0") {
    G.redReserve = reserve;
  } else {
    G.blueReserve = reserve;
  }

  // spawn
  const s: NonNullSquare = {
    type: unitType,
    player: ctx.currentPlayer === "0" ? "RED" : "BLUE",
    orientation: unitType.includes("ARTILLERY")
      ? ctx.currentPlayer === "0"
        ? 0
        : 180
      : undefined,
  };
  G.board[to[0]][to[1]] = s;

  G.thisTurnMoves.push({
    name: "Reinforce",
    args: [unitType, to],
  });
  G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);
  G.eval = calculateEval({
    ...G,
    currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
  });
};
const Move: Move<GHQState> = (
  { G, ctx, log, ...plugins },
  from: Coordinate,
  to: Coordinate,
  capturePreference?: Coordinate
) => {
  const piece = G.board[from[0]][from[1]];
  if (
    !G.isReplayMode &&
    !isMoveAllowed(G, ctx, {
      name: "Move",
      args: [from, to, capturePreference],
    })
  ) {
    return INVALID_MOVE;
  }

  G.board[from[0]][from[1]] = null;
  G.board[to[0]][to[1]] = piece;

  G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);

  let capturedPieceType: UnitType | undefined;

  if (capturePreference) {
    capturedPieceType =
      G.board[capturePreference[0]][capturePreference[1]]?.type;
    G.board[capturePreference[0]][capturePreference[1]] = null;
    G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"].push(capturePreference);
  }

  G.thisTurnMoves.push({
    name: "Move",
    args: [from, to, capturePreference],
  });
  log.setMetadata({
    pieceType: piece?.type,
    capturePreference,
    capturedPieceType,
  });
  G.eval = calculateEval({
    ...G,
    currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
  });
};

const MoveAndOrient: Move<GHQState> = (
  { G, ctx, log },
  from: Coordinate,
  to: Coordinate,
  orientation?: Orientation
) => {
  const piece = G.board[from[0]][from[1]]!;
  if (typeof Units[piece.type].artilleryRange === "undefined") {
    return INVALID_MOVE;
  }
  if (
    !G.isReplayMode &&
    !isMoveAllowed(G, ctx, {
      name: "MoveAndOrient",
      args: [from, to, orientation],
    })
  ) {
    return INVALID_MOVE;
  }

  piece!.orientation = orientation;
  G.board[from[0]][from[1]] = null;
  G.board[to[0]][to[1]] = piece;
  G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);

  G.thisTurnMoves.push({
    name: "MoveAndOrient",
    args: [from, to, orientation],
  });
  log.setMetadata({ pieceType: piece?.type });
  G.eval = calculateEval({
    ...G,
    currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
  });
};
const ChangeOrientation: Move<GHQState> = (
  { G, ctx, log },
  on: Coordinate,
  orientation: Orientation
) => {
  const piece = G.board[on[0]][on[1]];
  if (
    !G.isReplayMode &&
    !isMoveAllowed(G, ctx, {
      name: "MoveAndOrient",
      args: [on, on, orientation],
    })
  ) {
    return INVALID_MOVE;
  }

  piece!.orientation = orientation;
  G.board[on[0]][on[1]] = piece;
  G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(on);
  G.thisTurnMoves.push({
    name: "MoveAndOrient",
    args: [on, on, orientation],
  });
  log.setMetadata({ pieceType: piece?.type });
  G.eval = calculateEval({
    ...G,
    currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
  });
};

const Skip: Move<GHQState> = ({ G, ctx, events }) => {
  events.endTurn();
};

const Resign: Move<GHQState> = ({ G, ctx, events }) => {
  const gameover: GameoverState = {
    status: "WIN",
    winner: ctx.currentPlayer === "0" ? "BLUE" : "RED",
    reason: "by resignation",
  };
  events.endGame(gameover);
};

const OfferDraw: Move<GHQState> = {
  noLimit: true,
  move: ({ G, ctx }, offered: boolean) => {
    if (offered) {
      G.drawOfferedBy = ctx.currentPlayer;
    } else {
      G.drawOfferedBy = undefined;
    }
  },
};

const AcceptDraw: Move<GHQState> = {
  noLimit: true,
  move: ({ G, ctx, events }) => {
    if (!G.drawOfferedBy || G.drawOfferedBy === ctx.currentPlayer) {
      return INVALID_MOVE;
    }

    G.drawAcceptedBy = ctx.currentPlayer;
    const gameover: GameoverState = {
      status: "DRAW",
      reason: "draw accepted",
    };
    events.endGame(gameover);
  },
};

export const GameMoves = {
  Reinforce,
  Move,
  ChangeOrientation,
  MoveAndOrient,
  Skip,
  Resign,
  OfferDraw,
  AcceptDraw,
};

export type GameMoveType = typeof GameMoves;

export const defaultBoard: GHQState["board"] = [
  [
    { type: "HQ", player: "BLUE" },
    { type: "ARTILLERY", player: "BLUE", orientation: 180 },
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    null,
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [
    null,
    null,
    null,
    null,
    null,
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    { type: "ARTILLERY", player: "RED", orientation: 0 },
    { type: "HQ", player: "RED" },
  ],
];

export const defaultReserveFleet: ReserveFleet = {
  INFANTRY: 5,
  ARMORED_INFANTRY: 3,
  AIRBORNE_INFANTRY: 1,
  ARTILLERY: 2,
  ARMORED_ARTILLERY: 1,
  HEAVY_ARTILLERY: 1,
};

export const GHQGame: Game<GHQState> = {
  plugins: [HistoryPlugin],
  setup: ({ ctx, ...plugins }, setupData) => {
    return {
      startTime: Date.now(),
      turnStartTime: Date.now(),
      blueElapsed: 0,
      redElapsed: 0,
      bonusTime: 5 * 1000,
      lastPlayerMoves: [],
      timeControl: 10 * 60 * 1000,
      redTurnStartBoard: defaultBoard,
      blueTurnStartBoard: defaultBoard,
      board: defaultBoard,
      thisTurnMoves: [],
      eval: 0,
      redReserve: structuredClone(defaultReserveFleet),
      blueReserve: structuredClone(defaultReserveFleet),
      userIds: {
        "0": setupData?.players?.["0"] || "Player 1",
        "1": setupData?.players?.["1"] || "Player 2",
      },
      elos: {
        "0": setupData?.elos?.["0"] || 1000,
        "1": setupData?.elos?.["1"] || 1000,
      },
      matchId: setupData?.matchId || "",
      lastTurnMoves: {
        "0": [],
        "1": [],
      },
      lastTurnCaptures: {
        "0": [],
        "1": [],
      },
    };
  },
  turn: {
    maxMoves: 3,
    onBegin: ({ ctx, G, random, log, ...plugins }) => {
      G.lastPlayerMoves = G.thisTurnMoves;
      G.thisTurnMoves = [];
      G.lastTurnMoves[ctx.currentPlayer as "0" | "1"] = [];
      G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"] = [];

      const bombardCaptured = clearBombardedSquares(G, ctx);
      if (bombardCaptured.length > 0) {
        const clearedSquares = bombardCaptured.map(
          ({ coordinate }) => coordinate
        );
        G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"].push(
          ...clearedSquares
        );

        appendHistory(plugins, {
          isCapture: true,
          turn: ctx.turn,
          playerId: ctx.currentPlayer,
          captured: JSON.parse(JSON.stringify(bombardCaptured)), // deep copy for boardgame.io engine reasons
        });
      }

      const freeCaptured = freeInfantryCaptures(
        G.board,
        ctx.currentPlayer === "0" ? "RED" : "BLUE"
      );
      if (freeCaptured.length > 0) {
        const clearedSquares = freeCaptured.map(
          ({ capture }) => capture.coordinate
        ) as Coordinate[];
        G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"].push(
          ...clearedSquares
        );

        for (const {
          capture: { coordinate },
        } of freeCaptured) {
          G.board[coordinate[0]][coordinate[1]] = null;
        }

        const freeCapturedRes = freeCaptured.map(
          ({ capture: { coordinate, piece } }) => ({
            coordinate,
            square: piece,
          })
        );
        G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"].push(
          ...clearedSquares
        );

        const capturedByInfantry = freeCaptured.map(({ attacker }) => attacker);

        appendHistory(plugins, {
          isCapture: true,
          turn: ctx.turn,
          playerId: ctx.currentPlayer,
          captured: JSON.parse(JSON.stringify(freeCapturedRes)), // deep copy for boardgame.io engine reasons
          capturedByInfantry: JSON.parse(JSON.stringify(capturedByInfantry)), // deep copy for boardgame.io engine reasons
        });
      }

      G.turnStartTime = Date.now();
      G.eval = calculateEval({
        ...G,
        currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
      });
    },
    onEnd: ({ ctx, G }) => {
      const elapsed = Date.now() - G.turnStartTime;

      if (ctx.currentPlayer === "0") {
        G.redTurnStartBoard = JSON.parse(JSON.stringify(G.board));
      } else {
        G.blueTurnStartBoard = JSON.parse(JSON.stringify(G.board));
      }

      if (ctx.currentPlayer === "0") {
        G.redElapsed = G.redElapsed + elapsed - G.bonusTime;
      } else {
        G.blueElapsed = G.blueElapsed + elapsed - G.bonusTime;
      }
    },
  },
  endIf: ({ G }) => {
    return getGameoverState(G);
  },
  minPlayers: 2,
  maxPlayers: 2,
  moves: GameMoves,
  ai,
};

export function newOnlineGHQGame({
  onEnd,
}: {
  onEnd?: (args: FnContext<GHQState>) => void | GHQState;
}): Game<GHQState> {
  const game = { ...GHQGame };

  const oldSetup = game.setup;
  game.setup = ({ ctx, ...plugins }, setupData): GHQState => {
    if (!oldSetup) throw new Error("No setup function found");
    const state = oldSetup({ ctx, ...plugins }, setupData);
    state.isOnline = true;
    return state;
  };

  game.validateSetupData = (setupData, numPlayers) => {
    if (numPlayers !== 2) {
      return "Invalid number of players";
    }
    if (setupData) {
      if (!setupData.players["0"] || !setupData.players["1"]) {
        return "Missing player IDs";
      }
      if (!setupData.matchId) {
        return "Missing match ID";
      }
    }
  };

  if (onEnd) {
    game.onEnd = (args) => onEnd(args);
  }

  return game;
}

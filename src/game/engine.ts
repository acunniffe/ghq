import type { Ctx, FnContext, Game, Move } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";

import {
  clearBombardedSquares,
  freeInfantryCaptures,
} from "@/game/capture-logic";
import { getGameoverState } from "./gameover-logic";
import { isMoveAllowed, PlayerPiece } from "./board-moves";
import { calculateEval } from "./eval";
import { ai } from "./ai";
import { TIME_CONTROLS } from "./constants";
import { variants } from "./variants";
import { FENtoBoardState } from "./notation";
import { GameV2 } from "./engine-v2";

const deepCopy = (obj: any) => JSON.parse(JSON.stringify(obj));

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
  args: [
    autoCaptureType: "bombard" | "free",
    from?: Coordinate,
    capturePreference?: Coordinate
  ];
}

export interface SkipMove {
  name: "Skip";
  args: [];
}

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

export interface HistoryItem {
  message?: string;
  turn: number;
  isCapture: boolean;
  playerId?: string;
  captured?: { coordinate: Coordinate; square: Square }[];
  capturedByInfantry?: PlayerPiece[];
}

export interface GHQState {
  // True if this is an online game against other players.
  isOnline?: boolean;

  // True if this game is being replayed (disables animations, etc.)
  isReplayMode?: boolean;

  // True if this game is in pass-and-play mode (adds board perspective change).
  isPassAndPlayMode?: boolean;

  // Match ID for online games (possibly available already in BoardProps)
  matchId: string;

  // The current user's usernames and ELOs.
  userIds: {
    "0": string;
    "1": string;
  };
  elos: {
    "0": number;
    "1": number;
  };
  isTutorial: boolean;

  // The current board state.
  board: Board;

  // The board state at the start of the current turn.
  // These are being deprecated in favor of thisTurnBoards and lastTurnBoards.
  redTurnStartBoard: Board;
  blueTurnStartBoard: Board;

  // The turns made so far on this/last turn. Required to know what moves are playable this turn.
  thisTurnMoves: AllowedMove[];
  lastPlayerMoves: AllowedMove[];

  // This/last turn's board states (array of up to 3), largely used for animations.
  lastTurnBoards: Board[];
  thisTurnBoards: Board[];
  eval: number;
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;

  // Time control. All times are in milliseconds. Time control of 0 means no time control.
  redElapsed: number;
  blueElapsed: number;
  timeControl: number;
  bonusTime: number;
  startTime: number;
  turnStartTime: number;

  // Whether a draw has been offered or accepted.
  // NOTE(tyler): This probably needs to be moved outside of the game state,
  // because we want people to be able to offer/accept draws even if it's not their turn.
  drawOfferedBy?: string;
  drawAcceptedBy?: string;

  // Used to display move from most recent turn.
  // Deprecated. Don't use these if possible, instead use lastPlayerMoves and historyLog.
  lastTurnMoves: Record<"0" | "1", Coordinate[]>;
  lastTurnCaptures: Record<"0" | "1", Coordinate[]>;

  // Log that should probably be renamed StartOfTurnCaptures, since that's what it stores (as of 2024-11-30).
  historyLog?: HistoryItem[];

  // Flag that indicates if this game engine has 4 moves per turn. This is used to determine how to process moves in replay mode.
  // This was added on 2025-04-24.
  has4MovesPerTurn?: boolean;

  // Flag that indicates if this game engine has zone of control. This is used to determine if the player can move to a square that is adjacent to an enemy infantry.
  // This was added on 2025-05-02.
  enforceZoneOfControl?: boolean;

  isV2?: boolean;
  v2state?: string;
}

export interface GameoverState {
  status: "WIN" | "DRAW";
  winner?: Player;
  reason: string;
}

const Reinforce: Move<GHQState, any> = (
  { G, ctx, log, engine },
  unitType: keyof ReserveFleet,
  to: Coordinate,
  capturePreference?: Coordinate
) => {
  if (hasMoveLimitReached(ctx)) {
    return INVALID_MOVE;
  }

  const reserve = ctx.currentPlayer === "0" ? G.redReserve : G.blueReserve;
  if (
    !G.isReplayMode &&
    !isMoveAllowed(
      G,
      ctx,
      {
        name: "Reinforce",
        args: [unitType, to, capturePreference],
      },
      engine
    )
  ) {
    return INVALID_MOVE;
  }

  if (reserve[unitType] === 0) {
    return INVALID_MOVE;
  }
  G.thisTurnBoards.push(JSON.parse(JSON.stringify(G.board)));

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

  G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);

  let capturedPiece: Square = null;

  if (capturePreference) {
    const [x, y] = capturePreference;
    capturedPiece = JSON.parse(JSON.stringify(G.board[x][y])); // deep copy for boardgame.io engine reasons
    G.board[x][y] = null;
    G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"].push(capturePreference);
  }

  G.thisTurnMoves.push({
    name: "Reinforce",
    args: [unitType, to, capturePreference],
  });
  log.setMetadata({
    pieceType: unitType,
    capturePreference,
    capturedPiece,
  });
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
  if (hasMoveLimitReached(ctx)) {
    return INVALID_MOVE;
  }

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
  G.thisTurnBoards.push(JSON.parse(JSON.stringify(G.board)));

  G.board[from[0]][from[1]] = null;
  G.board[to[0]][to[1]] = piece;

  G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);

  let capturedPiece: Square = null;

  if (capturePreference) {
    const [x, y] = capturePreference;
    capturedPiece = JSON.parse(JSON.stringify(G.board[x][y])); // deep copy for boardgame.io engine reasons
    G.board[x][y] = null;
    G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"].push(capturePreference);
  }

  G.thisTurnMoves.push({
    name: "Move",
    args: [from, to, capturePreference],
  });
  log.setMetadata({
    pieceType: piece?.type,
    capturePreference,
    capturedPiece,
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
  if (hasMoveLimitReached(ctx)) {
    return INVALID_MOVE;
  }

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
  G.thisTurnBoards.push(JSON.parse(JSON.stringify(G.board)));

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
    enforceZoneOfControl: G.enforceZoneOfControl ?? false,
  });
};

const Skip: Move<GHQState> = {
  noLimit: true,
  move: ({ G, events }) => {
    if (G.isReplayMode) {
      return;
    }

    events.endTurn();
  },
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

export const emptyReserveFleet: ReserveFleet = {
  INFANTRY: 0,
  ARMORED_INFANTRY: 0,
  AIRBORNE_INFANTRY: 0,
  ARTILLERY: 0,
  ARMORED_ARTILLERY: 0,
  HEAVY_ARTILLERY: 0,
};

export const GHQGame: Game<GHQState> = {
  setup: ({ ctx, ...plugins }, setupData) => {
    const variant = variants[setupData?.variant];
    let redReserve = variant?.redReserve ?? deepCopy(defaultReserveFleet);
    let blueReserve = variant?.blueReserve ?? deepCopy(defaultReserveFleet);
    let board = variant?.board ?? defaultBoard;

    // Override using FEN if provided
    if (setupData?.fen) {
      const boardState = FENtoBoardState(setupData.fen);
      board = boardState.board;
      redReserve = boardState.redReserve;
      blueReserve = boardState.blueReserve;
    }

    return {
      isTutorial: false,
      startTime: Date.now(),
      turnStartTime: Date.now(),
      blueElapsed: 0,
      redElapsed: 0,
      bonusTime: setupData?.bonusTime ?? 10 * 1000,
      lastPlayerMoves: [],
      timeControl: setupData?.timeControl ?? 15 * 60 * 1000,
      redTurnStartBoard: board,
      blueTurnStartBoard: board,
      board,
      thisTurnMoves: [],
      lastTurnBoards: [],
      thisTurnBoards: [],
      eval: 0,
      redReserve,
      blueReserve,
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
      historyLog: [],
      has4MovesPerTurn: true,
      enforceZoneOfControl: true,
    };
  },
  turn: {
    minMoves: 1,
    maxMoves: 4,
    onBegin: ({ ctx, G }) => {
      G.lastPlayerMoves = G.thisTurnMoves;
      G.thisTurnMoves = [];
      G.lastTurnBoards = G.thisTurnBoards;
      G.thisTurnBoards = [];
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

        G.historyLog?.push({
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

        G.historyLog?.push({
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
  endIf: ({ G, ctx }) => {
    return getGameoverState(G, ctx.currentPlayer === "0" ? "RED" : "BLUE");
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
      if (setupData?.bonusTime !== undefined && setupData.bonusTime < 0) {
        return "Invalid bonus time";
      }
      if (setupData?.timeControl !== undefined && setupData.timeControl < 0) {
        return "Invalid time control";
      }
      if (setupData?.variant && !TIME_CONTROLS[setupData.variant]) {
        return "Invalid variant";
      }
      if (setupData?.fen && !FENtoBoardState(setupData.fen)) {
        return "Invalid FEN";
      }
    }
  };

  if (onEnd) {
    game.onEnd = (args) => onEnd(args);
  }

  return game;
}

export function newLocalGHQGame(): Game<GHQState> {
  const game = { ...GHQGame };

  const oldSetup = game.setup;
  game.setup = ({ ctx, ...plugins }, setupData): GHQState => {
    if (!oldSetup) throw new Error("No setup function found");
    const state = oldSetup({ ctx, ...plugins }, setupData);
    state.isPassAndPlayMode = true;
    return state;
  };

  return game;
}

export function hasMoveLimitReached(ctx: Ctx) {
  return ctx.numMoves !== undefined && ctx.numMoves >= 3;
}

export function ctxPlayerToPlayer(ctx: Ctx) {
  return ctx.currentPlayer === "0" ? "RED" : "BLUE";
}

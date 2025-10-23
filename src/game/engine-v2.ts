"use client";

import type { Ctx, Game, Plugin } from "boardgame.io";
import { useEffect, useState } from "react";
import { useScript } from "usehooks-ts";
import {
  AllowedMove,
  Board,
  Coordinate,
  ctxPlayerToPlayer,
  GameoverState,
  getCapturePreference,
  GHQGame,
  GHQState,
  isMoveCapture,
  NonNullSquare,
  Orientation,
  ReserveFleet,
  SkipMove,
  Square,
  UnitType,
} from "./engine";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";
import { BoardState, FENtoBoardState } from "./notation";
import { INVALID_MOVE } from "boardgame.io/core";
import { calculateEval } from "./eval";
import { LogAPI } from "boardgame.io/src/plugins/plugin-log";
import { getGameoverState } from "./gameover-logic";
import { printWelcome } from "@/lib/console";
import { createPGN, pgnToTurns, resignationTurn } from "./pgn";
import { TimeControl } from "./constants";
import { Multiplayer } from "./engine-v2-multiplayer";

export type Player = "RED" | "BLUE";

printWelcome();

export interface GameEngine {
  Move: {
    from_uci: (uci: string) => PythonMove;
  };
  BaseBoard: {
    (fen?: string): PythonBoard;
    deserialize: (serialized: string) => PythonBoard;
  };
  RandomPlayer: (board: PythonBoard) => PythonPlayer;
  ValuePlayer: (board: PythonBoard) => PythonPlayer;
}

export class GameV2 {
  constructor(private engine: GameEngine) {}

  generateLegalMoves(v2state: string): AllowedMove[] {
    const board = this.engine.BaseBoard.deserialize(v2state);
    const moves = board.generate_legal_moves();
    const ghqMoves = Array.from(moves).map((move) =>
      allowedMoveFromUci(move.uci())
    );
    return ghqMoves;
  }

  isLegalMove(v2state: string, ghqMove: AllowedMove): boolean {
    const board = this.engine.BaseBoard.deserialize(v2state);
    const move = this.engine.Move.from_uci(allowedMoveToUci(ghqMove));
    return board.is_legal(move);
  }

  push(
    v2state: string,
    ghqMove: AllowedMove
  ): { boardState: BoardState; v2state: string } {
    const board = this.engine.BaseBoard.deserialize(v2state);
    const move = this.engine.Move.from_uci(allowedMoveToUci(ghqMove));
    board.push(move);
    return {
      boardState: FENtoBoardState(board.board_fen()),
      v2state: board.serialize(),
    };
  }

  boardStatesFromFen(fen?: string): {
    boardState: BoardState;
    v2state: string;
  } {
    const board = this.engine.BaseBoard(fen);
    return {
      boardState: FENtoBoardState(board.board_fen()),
      v2state: board.serialize(),
    };
  }

  boardStates(v2state: string): { boardState: BoardState; v2state: string } {
    const board = this.engine.BaseBoard.deserialize(v2state);
    return {
      boardState: FENtoBoardState(board.board_fen()),
      v2state: board.serialize(),
    };
  }

  currentPlayerTurn(v2state: string): Player {
    const board = this.engine.BaseBoard.deserialize(v2state);
    return board.is_red_turn() ? "RED" : "BLUE";
  }

  getOutcome(
    v2state: string
  ): { winner?: Player; termination: string } | undefined {
    const board = this.engine.BaseBoard.deserialize(v2state);
    const outcome = board.outcome();
    if (!outcome) {
      return undefined;
    }

    let winner: Player | undefined;
    if (outcome.winner === false) {
      winner = "RED";
    } else if (outcome.winner === true) {
      winner = "BLUE";
    }

    return { winner, termination: outcome.termination };
  }
}

type PythonColor = boolean; // false = RED, true = BLUE
type PythonUnitType = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = HQ, 2 = INFANTRY, 3 = ARMORED_INFANTRY, 4 = AIRBORNE_INFANTRY, 5 = ARTILLERY, 6 = ARMORED_ARTILLERY, 7 = HEAVY_ARTILLERY
type PythonSquare = number; // 0-63
type PythonOrientation = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW

export interface PythonMove {
  uci: () => string;
  name: "Reinforce" | "Move" | "MoveAndOrient" | "AutoCapture" | "Skip";
  from_square?: PythonSquare;
  to_square?: PythonSquare;
  unit_type?: PythonUnitType;
  orientation?: PythonOrientation;
  capture_preference?: PythonSquare;
  auto_capture_type?: "bombard" | "free";
}

export interface PythonBoard {
  generate_legal_moves: () => Iterable<PythonMove>;
  push: (move: PythonMove) => void;
  board_fen: () => string;
  serialize: () => string;
  is_legal: (move: PythonMove) => boolean;
  is_red_turn: () => boolean;
  is_blue_turn: () => boolean;
  copy(): PythonBoard;
  turn_moves: number;
  reserves: PythonReserveFleet[];
  // move_stack: PythonMove[]
  piece_at: (squareIndex: number) => PythonPiece | undefined;
  outcome: () => PythonOutcome | undefined;
}

interface PythonReserveFleet {
  // Returns the reserves as an array of integers.
  // [INFANTRY, ARMORED_INFANTRY, AIRBORNE_INFANTRY, ARTILLERY, ARMORED_ARTILLERY, HEAVY_ARTILLERY]
  to_ints: () => [number, number, number, number, number, number];
}

interface PythonPiece {
  piece_type: PythonUnitType;
  color: PythonColor;
  orientation: PythonOrientation;
}

interface PythonOutcome {
  winner?: boolean; // false = RED, true = BLUE, undefined = DRAW
  termination: string;
}

export interface PythonPlayer {
  get_next_move: () => PythonMove;
}

export interface NewGameOptions {
  engine: GameEngine;
  fen?: string;
  type: "local" | "bot";
}

export function newGHQGameV2({
  engine,
  fen,
  type,
}: NewGameOptions): Game<GHQState> {
  const board = new GameV2(engine);
  const enginePlugin: Plugin<GameV2> = {
    name: "engine",
    api: () => {
      return board;
    },
  };

  function pushAndUpdateState(
    ctx: Ctx,
    G: GHQState,
    log: LogAPI,
    move: AllowedMove
  ) {
    if (!G.v2state) {
      throw new Error("v2state is not defined");
    }

    updateMoveShim(ctx, G, log, move);
    const states = board.push(G.v2state, move);
    updateStateFromStates(G, states);
  }

  function updateMoveShim(
    ctx: Ctx,
    G: GHQState,
    log: LogAPI,
    move: AllowedMove
  ) {
    let capturedPiece: Square = null;
    const capturePreference = getCapturePreference(move);
    if (capturePreference) {
      const [x, y] = capturePreference;
      capturedPiece = JSON.parse(JSON.stringify(G.board[x][y])); // deep copy for boardgame.io engine reasons
    }
    G.thisTurnMoves.push(move);

    let pieceType: UnitType | undefined;
    if (move.name === "Reinforce") {
      pieceType = move.args[0] as UnitType;
      const to = move.args[1];
      G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);
    } else if (move.name === "Move" || move.name === "MoveAndOrient") {
      const from = move.args[0];
      const to = move.args[1];
      pieceType = G.board[from[0]][from[1]]?.type;
      G.lastTurnMoves[ctx.currentPlayer as "0" | "1"].push(to);
    }

    G.thisTurnBoards.push(JSON.parse(JSON.stringify(G.board)));

    log.setMetadata({
      pieceType,
      capturePreference,
      capturedPiece,
      uci: allowedMoveToUci(move),
    });

    if (move.name === "AutoCapture" && move.args[0] === "bombard") {
      G.historyLog?.push({
        isCapture: true,
        turn: ctx.turn,
        playerId: ctx.currentPlayer,
        captured: JSON.parse(
          JSON.stringify([
            { coordinate: capturePreference, square: capturedPiece },
          ])
        ), // deep copy for boardgame.io engine reasons
      });
    } else if (move.name === "AutoCapture" && move.args[0] === "free") {
      G.historyLog?.push({
        isCapture: true,
        turn: ctx.turn,
        playerId: ctx.currentPlayer,
        captured: JSON.parse(
          JSON.stringify([
            { coordinate: capturePreference, square: capturedPiece },
          ])
        ), // deep copy for boardgame.io engine reasons
        capturedByInfantry: JSON.parse(
          JSON.stringify([
            {
              piece: capturedPiece,
              coordinate: capturePreference,
            },
          ])
        ), // deep copy for boardgame.io engine reasons
      });
    }
  }

  function updateStateFromStates(
    G: GHQState,
    { boardState, v2state }: { boardState: BoardState; v2state: string }
  ) {
    G.board = boardState.board;
    G.redReserve = boardState.redReserve;
    G.blueReserve = boardState.blueReserve;
    G.v2state = v2state;
    // TODO(tyler): figure out how to get this to work without overriding thisTurnMoves on the player's final turn
    // G.thisTurnMoves = boardState.thisTurnMoves ?? [];

    G.eval = calculateEval({
      ...G,
      currentPlayerTurn: boardState.currentPlayerTurn ?? "RED",
    });
  }

  return {
    setup: ({ ctx, ...plugins }, setupData) => {
      const v1Game = { ...GHQGame };
      if (!v1Game.setup) {
        throw new Error("GHQGame.setup is not defined");
      }

      const state = { ...v1Game.setup({ ctx, ...plugins }, setupData) };
      updateStateFromStates(state, board.boardStatesFromFen(fen));

      if (type === "bot") {
        applyBotOptions(state);
      }

      if (type === "local") {
        applyLocalOptions(state);
      }

      return {
        ...state,
        isV2: true,
      };
    },
    endIf: ({ G, ctx }) => {
      return getGameoverState(
        G,
        ctx.currentPlayer === "0" ? "RED" : "BLUE",
        board
      );
    },
    minPlayers: 2,
    maxPlayers: 2,
    moves: {
      push: ({ G, ctx, log }, move) => {
        if (!G.v2state) {
          throw new Error("v2state is not defined");
        }

        if (ctxPlayerToPlayer(ctx) !== board.currentPlayerTurn(G.v2state)) {
          return INVALID_MOVE;
        }

        if (!board.isLegalMove(G.v2state, move)) {
          return INVALID_MOVE;
        }

        pushAndUpdateState(ctx, G, log, move);
      },
      Skip: {
        noLimit: true,
        move: ({ G, ctx, events, log }) => {
          if (G.isReplayMode) {
            return;
          }

          if (!G.v2state) {
            throw new Error("v2state is not defined");
          }

          // If it's already the next player's turn, end the turn without sending a move.
          const { boardState } = board.boardStates(G.v2state);
          if (boardState.currentPlayerTurn !== ctxPlayerToPlayer(ctx)) {
            events.endTurn();
            return;
          }

          const move: SkipMove = { name: "Skip", args: [] };

          if (board.isLegalMove(G.v2state, move)) {
            pushAndUpdateState(ctx, G, log, move);
            events.endTurn();
            return;
          }

          return INVALID_MOVE;
        },
      },
    },
    turn: {
      minMoves: 0,
      maxMoves: 0,
      onBegin: ({ ctx, G, log, events }) => {
        if (!G.v2state) {
          throw new Error("v2state is not defined");
        }

        // If it's already the next player's turn, end the turn without sending a move.
        const { boardState } = board.boardStates(G.v2state);
        if (boardState.currentPlayerTurn !== ctxPlayerToPlayer(ctx)) {
          events.endTurn();
          return;
        }

        G.lastPlayerMoves = G.thisTurnMoves;
        G.thisTurnMoves = [];
        G.lastTurnBoards = G.thisTurnBoards;
        G.thisTurnBoards = [];
        G.lastTurnMoves[ctx.currentPlayer as "0" | "1"] = [];
        G.lastTurnCaptures[ctx.currentPlayer as "0" | "1"] = [];

        const allowedMoves = board.generateLegalMoves(G.v2state);
        for (const move of allowedMoves) {
          if (move.name === "AutoCapture" && move.args[0] === "bombard") {
            pushAndUpdateState(ctx, G, log, move);
          }
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
          G.redElapsed = G.redElapsed + elapsed - G.bonusTime;
        } else {
          G.blueElapsed = G.blueElapsed + elapsed - G.bonusTime;
        }
      },
    },
    plugins: [enginePlugin],
    ai: {
      enumerate: (G) => {
        if (!G.v2state) {
          throw new Error("v2state is not defined");
        }

        const board = engine.BaseBoard.deserialize(G.v2state);
        if (board.is_red_turn()) {
          return [
            {
              move: "Skip",
              args: [],
            },
          ];
        }

        const player = engine.ValuePlayer(board);
        // const start = Date.now();
        const move = player.get_next_move();
        // console.log(`Took ${Date.now() - start}ms`);
        const allowedMove = allowedMoveFromUci(move.uci());

        return [
          {
            move: "push",
            args: [allowedMove],
          },
        ];
      },
    },
  };
}

declare global {
  interface Window {
    loadPyodide: () => Promise<any>;
  }
}

export function useEngine(): { engine: GameEngine | null } {
  const [engine, setEngine] = useState<GameEngine | null>(null);

  const status = useScript(
    "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js",
    {
      removeOnUnmount: false,
      id: "pyodide",
    }
  );

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    loadEngine(window.loadPyodide).then(setEngine);
  }, [status]);

  return { engine };
}

export async function loadEngine(loadPyodide: () => Promise<any>) {
  let pyodide = await loadPyodide();
  await pyodide.runPythonAsync(`
        from pyodide.http import pyfetch
        response = await pyfetch("/engine.py")
        with open("engine.py", "wb") as f:
            f.write(await response.bytes())
      `);
  const enginePkg = pyodide.pyimport("engine");
  return enginePkg;
}

function applyBotOptions(state: GHQState) {
  state.isOnline = true;
  state.timeControl = 0;
  state.bonusTime = 0;
}

function applyLocalOptions(state: GHQState) {
  state.timeControl = 0;
  state.bonusTime = 0;
  state.isPassAndPlayMode = true;
}

export function numMovesThisTurn(G: GHQState) {
  return G.thisTurnMoves.filter(
    (move) => move.name !== "Skip" && move.name !== "AutoCapture"
  ).length;
}

export function hasMoveLimitReachedV2(G: GHQState) {
  return numMovesThisTurn(G) >= 3;
}

export interface PlayerPiece {
  piece: NonNullSquare;
  coordinate: Coordinate;
}

export interface Turn {
  turn: number;
  moves: AllowedMove[];
  elapsedSecs: number;
  // kind of a hack, but need to somehow send a resignation out of band
  isResignation?: boolean;
}

export interface GameClientOptions {
  engine?: GameEngine | null;
  multiplayer?: Multiplayer;
  playerId?: string;
  fen?: string;
  isTutorial?: boolean;
  isReplayMode?: boolean;
  isPassAndPlayMode?: boolean;
  timeControl?: TimeControl;
  id?: string; // implies isOnline
  gameStartTimeMs?: number;
}

export class GameClient {
  private engine: GameEngine;
  private boards: PythonBoard[];
  private currentBoardIndex: number;

  public isTutorial: boolean;
  public isReplayMode: boolean;
  public isPassAndPlayMode: boolean;
  public isOnline: boolean;
  public id?: string;
  public chatMessages: any[]; // TODO(tyler): implement this

  // Note: playerId is undefinend in local play (non-multiplayer, non-bot), also when spectating, replaying, and tutorials.
  public playerId?: string;

  // True if the current turn has been confirmed by the user before ending the turn.
  public needsTurnConfirmation: boolean;
  public turn: number;
  public moves: AllowedMove[];
  public turns: Turn[];
  private undoMoves: AllowedMove[];

  // Used for animations.
  private lastTurnBoards: PythonBoard[];
  private lastTurnMoves: AllowedMove[];
  private lastTurnCaptures: PlayerPiece[];
  private thisTurnBoards: PythonBoard[];
  private thisTurnMoves: AllowedMove[];
  private thisTurnCaptures: PlayerPiece[];
  private movePieces: (NonNullSquare | null)[]; // same length as moves
  private isProcessingMoves: boolean = false; // true if we the game is processing moves, e.g. from onTurnPlayed()

  // Time control
  public timeControl?: TimeControl;
  private gameStartTimeMs: number;

  // Multiplayer
  private multiplayer?: Multiplayer;
  public _uuid: string;

  private listeners: Set<() => void> = new Set();
  private playerResigned: "0" | "1" | undefined;

  constructor({
    engine,
    fen,
    isTutorial,
    isReplayMode,
    isPassAndPlayMode,
    id,
    timeControl,
    multiplayer,
    playerId,
    gameStartTimeMs,
  }: GameClientOptions) {
    if (!engine) {
      throw new Error("engine is required");
    }
    this.engine = engine;
    this.multiplayer = multiplayer;
    const board = this.engine.BaseBoard(fen);
    this.boards = [board];
    this.currentBoardIndex = 0;
    this.isTutorial = isTutorial ?? false;
    this.isReplayMode = isReplayMode ?? false;
    this.isPassAndPlayMode = isPassAndPlayMode ?? false;
    this.isOnline = !!id;
    this.id = id;
    this.chatMessages = [];
    this.playerId = playerId;
    this.undoMoves = [];
    this.turn = 1;
    this.timeControl = timeControl;
    this.needsTurnConfirmation = false;
    this.moves = [];
    this.turns = [];
    this.gameStartTimeMs = gameStartTimeMs ?? Date.now();
    this.thisTurnBoards = [];
    this.thisTurnMoves = [];
    this.thisTurnCaptures = [];
    this.lastTurnBoards = [];
    this.lastTurnMoves = [];
    this.lastTurnCaptures = [];
    this.movePieces = [];
    this._uuid = crypto.randomUUID();
    this.setupMultiplayer();
  }

  setupMultiplayer() {
    if (!this.multiplayer) {
      return;
    }

    this.isProcessingMoves = true;
    this.multiplayer.initGame();

    this.multiplayer.onTurnPlayed((turn) => {
      this.isProcessingMoves = true;
      if (turn.turn !== this.turn) {
        // TODO(tyler): if this is a turn in the past, we should verify that it matches our history,
        // otherwise we have a mismatch between client and server game state.
        console.log(
          `[GHQ] Skipping turn ${turn.turn}, expected turn ${this.turn}`
        );
        return;
      }

      this.pushTurn(turn, true);
      this.isProcessingMoves = false;
    });
  }

  // used for react components to re-render when the game state changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private board(): PythonBoard {
    return this.boards[this.currentBoardIndex];
  }

  private getTurn(): Turn {
    const t = this.turns[this.turn - 1];
    if (!t) {
      this.turns[this.turn - 1] = {
        turn: this.turn,
        moves: [],
        elapsedSecs: 0,
      };
    }
    return this.turns[this.turn - 1];
  }

  currentPlayer(): Player {
    if (this.isPassAndPlayMode) {
      return this.currentPlayerTurn();
    }

    return this.playerId === "0" ? "RED" : "BLUE";
  }

  isMyTurn(): boolean {
    return this.currentPlayer() === this.currentPlayerTurn();
  }

  currentPlayerTurn(): Player {
    const currentPlayerTurn = this.board().is_red_turn() ? "RED" : "BLUE";

    // If the player needs to confirm the turn, the other player is the current player.
    if (this.needsTurnConfirmation) {
      return currentPlayerTurn === "RED" ? "BLUE" : "RED";
    }
    return currentPlayerTurn;
  }

  numTurns(): number {
    return this.boards.length;
  }

  numMovesThisTurn(): number {
    if (this.needsTurnConfirmation) {
      return 3;
    }
    return this.board().turn_moves;
  }

  hasMoveLimitReached(): boolean {
    return this.numMovesThisTurn() >= 3;
  }

  reserves(player: Player): ReserveFleet {
    const reserves = this.board().reserves[player === "RED" ? 0 : 1].to_ints();
    return {
      INFANTRY: reserves[0] || 0,
      ARMORED_INFANTRY: reserves[1] || 0,
      AIRBORNE_INFANTRY: reserves[2] || 0,
      ARTILLERY: reserves[3] || 0,
      ARMORED_ARTILLERY: reserves[4] || 0,
      HEAVY_ARTILLERY: reserves[5] || 0,
    };
  }

  getAllowedMoves(): AllowedMove[] {
    if (!this.isMyTurn() || this.needsTurnConfirmation) {
      return [];
    }
    const moves = this.board().generate_legal_moves();
    const ghqMoves = Array.from(moves).map((move) =>
      allowedMoveFromUci(move.uci())
    );
    return ghqMoves;
  }

  _push(ghqMove: AllowedMove) {
    // NB(tyler): be careful to undo any state changes here in undo()

    const move = this.engine.Move.from_uci(allowedMoveToUci(ghqMove));

    // Update animation state
    this.thisTurnBoards.push(this.board());
    this.thisTurnMoves.push(ghqMove);

    if (move.from_square) {
      this.movePieces.push(
        pieceToSquare(this.board().piece_at(move.from_square))
      );
    } else {
      this.movePieces.push(null);
    }

    if (move.capture_preference) {
      this.thisTurnCaptures.push({
        piece: pieceToSquare(this.board().piece_at(move.capture_preference))!,
        coordinate: coordinateFromPythonSquare(move.capture_preference),
      });
    }

    // Update game state
    const newBoard = this.engine.BaseBoard.deserialize(
      this.board().serialize()
    ); // TODO(tyler): figure out why copy() doesn't work
    newBoard.push(move);
    this.boards.push(newBoard);
    this.currentBoardIndex++;
    this.moves = [...this.moves, ghqMove];
    this.getTurn().moves.push(ghqMove);
    this.notify();
  }

  push(ghqMove: AllowedMove, clearUndoMoves: boolean = true) {
    if (clearUndoMoves) {
      this.undoMoves = [];
    }

    const prevPlayer = this.currentPlayerTurn();

    this._push(ghqMove);

    // If the player has changed, we need to wait to confirm the turn before ending it.
    const newPlayer = this.currentPlayerTurn();
    if (newPlayer !== prevPlayer) {
      this.needsTurnConfirmation = true;
    }
  }

  gameover(): GameoverState | undefined {
    if (this.isReplayMode) {
      return undefined;
    }

    // Don't show gameover state until we've processed all turns, to avoid accidentally thinking its a timeout or something.
    if (this.isProcessingMoves) {
      return undefined;
    }

    if (this.playerResigned) {
      return {
        status: "WIN",
        winner: this.playerResigned === "0" ? "RED" : "BLUE",
        reason: "by opponent resignation",
      };
    }

    const currentPlayer = this.currentPlayerTurn();
    const currentPlayerTimeLeftMs = this.getPlayerTimeLeftMs(
      currentPlayer,
      true
    );
    if (currentPlayerTimeLeftMs !== null && currentPlayerTimeLeftMs <= 0) {
      return {
        status: "WIN",
        winner: currentPlayer === "RED" ? "BLUE" : "RED", // Opponent wins by time out
        reason: "on time",
      };
    }

    const outcome = this.board().outcome();
    if (outcome) {
      let status: "WIN" | "DRAW" = "DRAW";
      let winner: Player | undefined;

      if (outcome.winner === false) {
        winner = "RED";
        status = "WIN";
      } else if (outcome.winner === true) {
        winner = "BLUE";
        status = "WIN";
      }
      return {
        status,
        winner,
        reason: `by ${outcome.termination}`,
      };
    }

    return undefined;
  }

  sendChatMessage({ message, time }: { message: string; time: number }) {
    // TODO(tyler): implement this
    throw new Error("not implemented");
  }

  canUndo(): boolean {
    return this.isMyTurn() && this.numMovesThisTurn() > 0;
  }

  undo() {
    if (!this.canUndo()) {
      throw new Error("cannot undo");
    }

    const latestMove = this.moves[this.moves.length - 1];
    this.moves = this.moves.slice(0, -1);
    if (latestMove) {
      this.undoMoves.push(latestMove);
      this.getTurn().moves.pop();
      this.boards.pop();
      this.thisTurnBoards.pop();
      this.thisTurnMoves.pop();
      if (isMoveCapture(latestMove)) {
        this.thisTurnCaptures.pop();
      }
      this.movePieces.pop();
      this.currentBoardIndex--;
      this.needsTurnConfirmation = false;
      this.notify();
    }
  }

  canRedo(): boolean {
    return this.isMyTurn() && this.undoMoves.length > 0;
  }

  redo() {
    if (!this.canRedo()) {
      throw new Error("cannot redo");
    }

    const latestMove = this.undoMoves.pop();
    if (latestMove) {
      this.push(latestMove, false);
    }
  }

  canEndTurn(): boolean {
    return true;
  }

  endTurn() {
    if (!this.needsTurnConfirmation) {
      this._push({ name: "Skip", args: [] });
    }

    this.getTurn().elapsedSecs =
      Math.round((Date.now() - this.getTurnStartTimeMs()) / 100) / 10;

    const turn = this.getTurn();
    this.finishTurn();

    if (this.multiplayer) {
      this.multiplayer.sendTurn(turn);
    }
  }

  pushTurn(turn: Turn, skipBombardments: boolean = false) {
    if (turn.isResignation) {
      this.playerResigned = turn.turn % 2 === 0 ? "0" : "1"; // 0 is red, 1 is blue
    }

    for (const move of turn.moves) {
      this.push(move);
    }

    this.getTurn().elapsedSecs = turn.elapsedSecs;

    this.finishTurn(skipBombardments);
  }

  finishTurn(skipBombardments: boolean = false) {
    if (this.needsTurnConfirmation) {
      this.needsTurnConfirmation = false;
    }

    this.turn = this.turn + 1;
    this.lastTurnBoards = this.thisTurnBoards;
    this.lastTurnMoves = this.thisTurnMoves;
    this.lastTurnCaptures = this.thisTurnCaptures;
    this.thisTurnBoards = [];
    this.thisTurnMoves = [];
    this.thisTurnCaptures = [];
    if (!skipBombardments) {
      this.clearBombardments();
    }
    this.notify();
  }

  clearBombardments() {
    const allowedMoves = this.board().generate_legal_moves();
    for (const move of allowedMoves) {
      if (move.name === "AutoCapture" && move.auto_capture_type === "bombard") {
        this._push(allowedMoveFromUci(move.uci()));
      }
    }
  }

  getTurnStartTimeMs(): number {
    const elapsedMs =
      this.turns.reduce((acc, turn) => {
        return acc + turn.elapsedSecs;
      }, 0) * 1000;
    return this.gameStartTimeMs + elapsedMs;
  }

  getPlayerTimeLeftMs(player: Player, isLive: boolean = false): number | null {
    if (!this.timeControl) {
      return null;
    }

    const currentTurnElapsedMs =
      isLive && player === this.currentPlayerTurn()
        ? Date.now() - this.getTurnStartTimeMs()
        : 0;

    const useEvens = player === "RED";
    const completedPlayerTurns = this.turns
      .filter((_, i) => (useEvens ? i % 2 === 0 : i % 2 === 1))
      .filter((turn) => turn.elapsedSecs > 0);

    const bonusMs = completedPlayerTurns.length * this.timeControl.bonus;

    const elapsedMs =
      completedPlayerTurns.reduce((acc, turn) => {
        return acc + turn.elapsedSecs;
      }, 0) * 1000;

    return this.timeControl.time - elapsedMs - currentTurnElapsedMs + bonusMs;
  }

  getV1Board(): Board {
    return getV1Board(this.board());
  }

  getLastTurnBoards(): Board[] {
    return this.lastTurnBoards.map(getV1Board);
  }

  getLastTurnMoves(): AllowedMove[] {
    return this.lastTurnMoves;
  }

  getRecentCaptures(): PlayerPiece[] {
    return [...this.lastTurnCaptures, ...this.thisTurnCaptures];
  }

  fen(): string {
    return this.board().board_fen();
  }

  pgn(): string {
    return createPGN(this.turns);
  }

  eval(): number {
    return calculateEval({
      board: this.getV1Board(),
    });
  }

  resign() {
    if (this.multiplayer) {
      this.multiplayer.sendTurn(resignationTurn(this.turn));
    } else {
      this.playerResigned = this.currentPlayer() === "RED" ? "1" : "0";
    }
  }

  reset() {
    this.boards = [this.engine.BaseBoard()];
    this.currentBoardIndex = 0;
    this.turn = 1;
    this.moves = [];
    this.turns = [];
    this.undoMoves = [];
    this.needsTurnConfirmation = false;
    this.thisTurnBoards = [];
    this.thisTurnMoves = [];
    this.thisTurnCaptures = [];
    this.lastTurnBoards = [];
    this.lastTurnMoves = [];
    this.lastTurnCaptures = [];
    this.movePieces = [];
    this.notify();
  }

  applyMoves(pgn: string, seekIndex: number = 0) {
    this.reset();

    let i = 0;
    const turns = pgnToTurns(pgn);
    for (const turn of turns) {
      if (i >= seekIndex) {
        break;
      }

      const movesLeftToAdd = seekIndex - i;
      if (movesLeftToAdd > turn.moves.length) {
        this.pushTurn(turn, true);
        i += turn.moves.length;
        continue;
      }

      for (const move of turn.moves) {
        if (i >= seekIndex) {
          break;
        }
        this.push(move);
        i++;
      }
    }
  }
}

function pieceToSquare(piece: PythonPiece | undefined): Square | null {
  if (!piece) {
    return null;
  }
  return {
    type: pieceTypeToUnitType(piece),
    player: piece.color ? "BLUE" : "RED",
    orientation: orientationToOrientation(piece.orientation),
  };
}

function pieceTypeToUnitType(piece: PythonPiece): UnitType {
  switch (piece.piece_type) {
    case 1:
      return "HQ";
    case 2:
      return "INFANTRY";
    case 3:
      return "ARMORED_INFANTRY";
    case 4:
      return "AIRBORNE_INFANTRY";
    case 5:
      return "ARTILLERY";
    case 6:
      return "ARMORED_ARTILLERY";
    case 7:
      return "HEAVY_ARTILLERY";
    default:
      throw new Error(`Invalid piece type: ${piece.piece_type}`);
  }
}

function orientationToOrientation(
  orientation: PythonPiece["orientation"]
): Orientation {
  return (orientation * 45) as Orientation; // 0 = N, 45 = NE, 90 = E, 135 = SE, 180 = S, 225 = SW, 270 = W, 315 = NW
}

const coordinateMapping: Coordinate[] = [
  [7, 0],
  [7, 1],
  [7, 2],
  [7, 3],
  [7, 4],
  [7, 5],
  [7, 6],
  [7, 7],
  [6, 0],
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [6, 6],
  [6, 7],
  [5, 0],
  [5, 1],
  [5, 2],
  [5, 3],
  [5, 4],
  [5, 5],
  [5, 6],
  [5, 7],
  [4, 0],
  [4, 1],
  [4, 2],
  [4, 3],
  [4, 4],
  [4, 5],
  [4, 6],
  [4, 7],
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  [3, 5],
  [3, 6],
  [3, 7],
  [2, 0],
  [2, 1],
  [2, 2],
  [2, 3],
  [2, 4],
  [2, 5],
  [2, 6],
  [2, 7],
  [1, 0],
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 7],
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
];

function getV1Board(board: PythonBoard): Board {
  const gp = (i: number) => pieceToSquare(board.piece_at(i));

  return [
    [gp(56), gp(57), gp(58), gp(59), gp(60), gp(61), gp(62), gp(63)],
    [gp(48), gp(49), gp(50), gp(51), gp(52), gp(53), gp(54), gp(55)],
    [gp(40), gp(41), gp(42), gp(43), gp(44), gp(45), gp(46), gp(47)],
    [gp(32), gp(33), gp(34), gp(35), gp(36), gp(37), gp(38), gp(39)],
    [gp(24), gp(25), gp(26), gp(27), gp(28), gp(29), gp(30), gp(31)],
    [gp(16), gp(17), gp(18), gp(19), gp(20), gp(21), gp(22), gp(23)],
    [gp(8), gp(9), gp(10), gp(11), gp(12), gp(13), gp(14), gp(15)],
    [gp(0), gp(1), gp(2), gp(3), gp(4), gp(5), gp(6), gp(7)],
  ];
}

function coordinateFromPythonSquare(square: PythonSquare): Coordinate {
  return coordinateMapping[square];
}

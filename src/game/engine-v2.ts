"use client";

import type { Ctx, Game, Plugin } from "boardgame.io";
import { useEffect, useState } from "react";
import { useScript } from "usehooks-ts";
import {
  AllowedMove,
  Board,
  ctxPlayerToPlayer,
  GameoverState,
  getCapturePreference,
  GHQGame,
  GHQState,
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

export type Player = "RED" | "BLUE";

printWelcome();

export interface GameEngine {
  Move: {
    from_uci: (uci: string) => any;
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

export interface PythonMove {
  uci: () => string;
}

export interface PythonBoard {
  generate_legal_moves: () => Iterable<PythonMove>;
  push: (move: PythonMove) => void;
  board_fen: () => string;
  serialize: () => string;
  is_legal: (move: PythonMove) => boolean;
  is_red_turn: () => boolean;
  is_blue_turn: () => boolean;
  outcome: () => { winner?: boolean; termination: string } | undefined;
  copy(): PythonBoard;
  turn_moves: number;
  reserves: PythonReserveFleet[];
  // move_stack: PythonMove[]
  piece_at: (squareIndex: number) => PythonPiece | undefined;
}

interface PythonReserveFleet {
  // Returns the reserves as an array of integers.
  // [INFANTRY, ARMORED_INFANTRY, AIRBORNE_INFANTRY, ARTILLERY, ARMORED_ARTILLERY, HEAVY_ARTILLERY]
  to_ints: () => [number, number, number, number, number, number];
}

interface PythonPiece {
  piece_type: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = HQ, 2 = INFANTRY, 3 = ARMORED_INFANTRY, 4 = AIRBORNE_INFANTRY, 5 = ARTILLERY, 6 = ARMORED_ARTILLERY, 7 = HEAVY_ARTILLERY
  color: boolean; // false = RED, true = BLUE
  orientation: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW
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

export interface GameClientOptions {
  engine: GameEngine;
  fen?: string;
  isTutorial: boolean;
  isReplayMode: boolean;
  isPassAndPlayMode: boolean;
  id?: string; // implies isOnline
}

export class GameClient {
  private engine: GameEngine;
  private boards: PythonBoard[];
  private currentBoardIndex: number;
  private turn: number;

  public isTutorial: boolean;
  public isReplayMode: boolean;
  public isPassAndPlayMode: boolean;
  public isOnline: boolean;
  public id?: string;
  public chatMessages: any[]; // TODO(tyler): not implemented

  // Note: playerID is null in local play (non-multiplayer, non-bot), also when spectating, replaying, and tutorials.
  public playerID: string | null; // bgio backwards compat
  private localPlayerColor: Player; // bgio backwards compat

  // True if the current turn has been confirmed by the user before ending the turn.
  public needsTurnConfirmation: boolean;
  public moves: AllowedMove[];
  private undoMoves: AllowedMove[];

  // Time control
  public totalTimeAllowed: number;
  public bonusTime: number;
  public startTimeMs: number;
  public elapsedMs: {
    RED: number;
    BLUE: number;
  };

  public userIds: {
    "0": string;
    "1": string;
  };

  constructor({
    engine,
    fen,
    isTutorial,
    isReplayMode,
    isPassAndPlayMode,
    id,
  }: GameClientOptions) {
    this.engine = engine;
    const board = this.engine.BaseBoard(fen);
    this.boards = [board];
    this.currentBoardIndex = 0;
    this.isTutorial = isTutorial;
    this.isReplayMode = isReplayMode;
    this.isPassAndPlayMode = isPassAndPlayMode;
    this.isOnline = !!id;
    this.id = id;
    this.chatMessages = [];
    this.playerID = null;
    this.localPlayerColor = "RED";
    this.undoMoves = [];
    this.turn = 1;
    this.userIds = {
      "0": "",
      "1": "",
    };
    this.totalTimeAllowed = 0;
    this.bonusTime = 0;
    this.startTimeMs = 0;
    this.elapsedMs = {
      RED: 0,
      BLUE: 0,
    };
    this.needsTurnConfirmation = false;
    this.moves = [];
  }

  private board(): PythonBoard {
    return this.boards[this.currentBoardIndex];
  }

  currentPlayer(): Player {
    if (this.isPassAndPlayMode) {
      return this.currentPlayerTurn();
    }

    return this.playerID === "0" ? "RED" : "BLUE";
  }

  isMyTurn(): boolean {
    return this.currentPlayer() === this.currentPlayerTurn();
  }

  currentPlayerTurn(): Player {
    const currentPlayerTurn = this.board().is_red_turn() ? "RED" : "BLUE";
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

  currentTurn(): number {
    return this.turn;
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
    const moves = this.board().generate_legal_moves();
    const ghqMoves = Array.from(moves).map((move) =>
      allowedMoveFromUci(move.uci())
    );
    return ghqMoves;
  }

  _push(ghqMove: AllowedMove) {
    const move = this.engine.Move.from_uci(allowedMoveToUci(ghqMove));
    const newBoard = this.engine.BaseBoard.deserialize(
      this.board().serialize()
    ); // TODO(tyler): figure out why copy() doesn't work
    newBoard.push(move);
    this.boards.push(newBoard);
    this.currentBoardIndex++;
  }

  push(ghqMove: AllowedMove, clearnUndoMoves: boolean = true) {
    if (clearnUndoMoves) {
      this.undoMoves = [];
    }

    const prevPlayer = this.currentPlayerTurn();

    this._push(ghqMove);
    this.moves.push(ghqMove);

    // If the player has changed, we need to wait to confirm the turn before ending it.
    const newPlayer = this.currentPlayerTurn();
    if (newPlayer !== prevPlayer) {
      this.needsTurnConfirmation = true;
    }
  }

  gameover(): GameoverState | undefined {
    // return this.game.getGameoverState(this.states[this.currentStateIndex]);
    return undefined;
  }

  sendChatMessage({ message, time }: { message: string; time: number }) {
    throw new Error("not implemented");
  }

  canUndo(): boolean {
    return this.isMyTurn() && this.numMovesThisTurn() > 0;
  }

  undo() {
    if (!this.canUndo()) {
      throw new Error("cannot undo");
    }

    const latestMove = this.moves.pop();
    if (latestMove) {
      this.undoMoves.push(latestMove);
      this.boards.pop();
      this.currentBoardIndex--;
      this.needsTurnConfirmation = false;
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
    if (this.needsTurnConfirmation) {
      this.needsTurnConfirmation = false;
    } else {
      this._push({ name: "Skip", args: [] });
    }

    this.turn++;
  }

  pieceAt(squareIndex: number): Square {
    const p = this.board().piece_at(squareIndex);
    if (!p) {
      return null;
    }
    return pieceToSquare(p);
  }

  getV1Board(): Board {
    const gp = (i: number) => this.pieceAt(i);

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

  fen(): string {
    return this.board().board_fen();
  }

  pgn(): string {
    return this.moves.map(allowedMoveToUci).join(" ");
  }

  eval(): number {
    return calculateEval({
      board: this.getV1Board(),
    });
  }

  resign() {
    throw new Error("not implemented");
  }

  reset() {
    this.boards = [this.engine.BaseBoard()];
    this.currentBoardIndex = 0;
    this.turn = 1;
    this.moves = [];
    this.undoMoves = [];
    this.needsTurnConfirmation = false;
    this.elapsedMs = {
      RED: 0,
      BLUE: 0,
    };
    this.totalTimeAllowed = 0;
    this.bonusTime = 0;
    this.startTimeMs = 0;
  }

  applyMoves(pgn: string, index: number = 0) {
    if (index === 0) {
      this.reset();
    }

    if (index > 0) {
      if (index > this.boards.length) {
        throw new Error(
          `index is out of bounds: ${index} > ${this.boards.length}`
        );
      }
    }

    let currentIndex = index;
    const moves = pgn
      .split(" ")
      .filter((move) => move !== "")
      .map((move) => allowedMoveFromUci(move));
    for (const move of moves) {
      currentIndex++;

      // skip if we already have this index in the boards array
      if (currentIndex <= this.currentBoardIndex) {
        continue;
      }

      // otherwise push the move
      this.push(move);
    }
  }
}

export function hasMoveLimitReached(g: GameClient): boolean {
  // TODO(tyler): implement this
  return false;
}

export type NonNullSquare = Exclude<Square, null>;

function pieceToSquare(piece: PythonPiece): Square {
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

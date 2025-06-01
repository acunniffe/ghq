"use client";

import type { Ctx, Game, Plugin } from "boardgame.io";
import { useEffect, useState } from "react";
import { useScript } from "usehooks-ts";
import {
  AllowedMove,
  ctxPlayerToPlayer,
  getCapturePreference,
  GHQGame,
  GHQState,
  Player,
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
    plugins: [enginePlugin],
    ai: {
      enumerate: (G) => {
        if (!G.v2state) {
          throw new Error("v2state is not defined");
        }

        const board = engine.BaseBoard(G.v2state);
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

export function numMovesThisTurn(G: GHQState) {
  return G.thisTurnMoves.filter(
    (move) => move.name !== "Skip" && move.name !== "AutoCapture"
  ).length;
}

export function hasMoveLimitReachedV2(G: GHQState) {
  return numMovesThisTurn(G) >= 3;
}

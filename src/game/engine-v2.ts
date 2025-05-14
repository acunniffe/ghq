"use client";

import type { Game, Plugin } from "boardgame.io";
import { useEffect, useState } from "react";
import { useScript } from "usehooks-ts";
import {
  AllowedMove,
  ctxPlayerToPlayer,
  GHQGame,
  GHQState,
  SkipMove,
} from "./engine";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";
import { FENtoBoardState } from "./notation";
import { INVALID_MOVE } from "boardgame.io/core";

export interface GameEngine {
  Move: {
    from_uci: (uci: string) => any;
  };
  BaseBoard: (fen?: string) => PythonBoard;
}

export class GameV2 {
  constructor(private engine: GameEngine) {}

  generateLegalMoves(boardFen: string): AllowedMove[] {
    const board = this.engine.BaseBoard(boardFen);
    const moves = board.generate_legal_moves();
    const ghqMoves = Array.from(moves).map((move) =>
      allowedMoveFromUci(move.uci())
    );
    return ghqMoves;
  }

  isLegalMove(boardFen: string, ghqMove: AllowedMove): boolean {
    const board = this.engine.BaseBoard(boardFen);
    const move = this.engine.Move.from_uci(allowedMoveToUci(ghqMove));
    return board.is_legal(move);
  }

  push(boardFen: string, ghqMove: AllowedMove) {
    const board = this.engine.BaseBoard(boardFen);
    const move = this.engine.Move.from_uci(allowedMoveToUci(ghqMove));
    board.push(move);
    return board.board_fen();
  }

  defaultBoardFen(): string {
    return this.engine.BaseBoard().board_fen();
  }
}

export interface PythonMove {
  uci: () => string;
}

export interface PythonBoard {
  generate_legal_moves: () => Iterable<PythonMove>;
  push: (move: PythonMove) => void;
  board_fen: () => string;
  is_legal: (move: PythonMove) => boolean;
  // move_from_uci: (uci: string) => any;
}

export function newGHQGameV2(engine: GameEngine, fen?: string): Game<GHQState> {
  const board = new GameV2(engine);
  const enginePlugin: Plugin<GameV2> = {
    name: "engine",
    api: () => {
      return board;
    },
  };

  function pushAndUpdateState(G: GHQState, move: AllowedMove) {
    if (!G.v2state) {
      throw new Error("v2state is not defined");
    }

    const boardFen = board.push(G.v2state, move);
    updateStateFromFen(G, boardFen);
  }

  function updateStateFromFen(G: GHQState, fen: string) {
    const boardState = FENtoBoardState(fen);
    G.board = boardState.board;
    G.redReserve = boardState.redReserve;
    G.blueReserve = boardState.blueReserve;
    G.thisTurnMoves = boardState.thisTurnMoves ?? [];
    G.v2state = fen;
  }

  return {
    setup: ({ ctx, ...plugins }, setupData) => {
      const v1Game = { ...GHQGame };
      if (!v1Game.setup) {
        throw new Error("GHQGame.setup is not defined");
      }

      const state = { ...v1Game.setup({ ctx, ...plugins }, setupData) };
      updateStateFromFen(state, fen ?? board.defaultBoardFen());
      return {
        ...state,
        isV2: true,
      };
    },
    turn: {
      minMoves: 1,
      maxMoves: 4,
      onBegin: ({ ctx, G }) => {},
      onEnd: ({ ctx, G }) => {},
    },
    endIf: ({ G, ctx }) => {},
    minPlayers: 2,
    maxPlayers: 2,
    moves: {
      push: ({ G, ctx, log }, move) => {
        if (!G.v2state) {
          throw new Error("v2state is not defined");
        }

        if (!board.isLegalMove(G.v2state, move)) {
          return INVALID_MOVE;
        }

        pushAndUpdateState(G, move);
      },
      Skip: {
        noLimit: true,
        move: ({ G, ctx, events }) => {
          if (G.isReplayMode) {
            return;
          }

          if (!G.v2state) {
            throw new Error("v2state is not defined");
          }
          console.log("skipping", G.thisTurnMoves.length);

          // If it's already the next player's turn, end the turn without sending a move.
          const boardState = FENtoBoardState(G.v2state);
          if (boardState.currentPlayerTurn !== ctxPlayerToPlayer(ctx)) {
            events.endTurn();
            return;
          }

          const move: SkipMove = { name: "Skip", args: [] };

          if (board.isLegalMove(G.v2state, move)) {
            pushAndUpdateState(G, move);
            events.endTurn();
            return;
          }

          return INVALID_MOVE;
        },
      },
    },
    plugins: [enginePlugin],
  };
}

declare global {
  interface Window {
    loadPyodide: () => Promise<any>;
  }
}

export function useEngine(): { engine: GameEngine } {
  const [engine, setEngine] = useState<any>(null);

  const status = useScript(
    "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js",
    {
      removeOnUnmount: false,
      id: "pyodide",
    }
  );

  async function loadEngine() {
    let pyodide = await window.loadPyodide();
    await pyodide.runPythonAsync(`
        from pyodide.http import pyfetch
        response = await pyfetch("/engine.py")
        with open("engine.py", "wb") as f:
            f.write(await response.bytes())
      `);
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("numpy");

    const enginePkg = pyodide.pyimport("engine");
    setEngine(enginePkg);
  }

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    loadEngine();
  }, [status]);

  return { engine };
}

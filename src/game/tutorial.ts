import type { Game } from "boardgame.io";

import { GHQGame, GHQState, ReserveFleet, Square } from "./engine";
import { BoardArrowType } from "./BoardArrow";
import { BoardState, FENtoBoardState, boardToFEN } from "./notation";
import { endgame } from "./variants";

export const B: Record<string, Square> = {
  HQ: { type: "HQ", player: "BLUE" },
  IN: { type: "INFANTRY", player: "BLUE" },
  AI: { type: "ARMORED_INFANTRY", player: "BLUE" },
  AB: { type: "AIRBORNE_INFANTRY", player: "BLUE" },
  AR: { type: "ARTILLERY", player: "BLUE", orientation: 180 },
  A1: { type: "ARTILLERY", player: "BLUE", orientation: 135 },
  AA: { type: "ARMORED_ARTILLERY", player: "BLUE", orientation: 180 },
  A2: { type: "ARMORED_ARTILLERY", player: "BLUE", orientation: 225 },
  HA: { type: "HEAVY_ARTILLERY", player: "BLUE", orientation: 180 },
  H1: { type: "HEAVY_ARTILLERY", player: "BLUE", orientation: 135 },
};

export const R: Record<string, Square> = {
  HQ: { type: "HQ", player: "RED" },
  IN: { type: "INFANTRY", player: "RED" },
  AI: { type: "ARMORED_INFANTRY", player: "RED" },
  AB: { type: "AIRBORNE_INFANTRY", player: "RED" },
  AR: { type: "ARTILLERY", player: "RED", orientation: 0 },
  A1: { type: "ARTILLERY", player: "RED", orientation: 45 },
  AA: { type: "ARMORED_ARTILLERY", player: "RED", orientation: 0 },
  HA: { type: "HEAVY_ARTILLERY", player: "RED", orientation: 0 },
  H1: { type: "HEAVY_ARTILLERY", player: "RED", orientation: 315 },
};

const emptyReserveFleet: ReserveFleet = {
  INFANTRY: 0,
  ARMORED_INFANTRY: 0,
  AIRBORNE_INFANTRY: 0,
  ARTILLERY: 0,
  ARMORED_ARTILLERY: 0,
  HEAVY_ARTILLERY: 0,
};

export interface TutorialSetupData {
  boardState?: BoardState;
  category: "capturing" | "puzzles" | "endgames";
  boardArrows: BoardArrowType[];
  fen?: string;
}

export const boards: Record<string, TutorialSetupData> = {
  "Infantry capture infantry": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, B.IN, null, null, null, null],
        [null, null, null, R.IN, R.IN, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [4, 4], to: [3, 4] }],
  },
  "Armored infantry capture infantry": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, B.IN, null, null, null, null],
        [null, null, null, R.IN, B.IN, null, null, null],
        [null, null, R.AI, null, R.IN, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [5, 2], to: [3, 2] }],
  },
  "Infantry capture artillery": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, B.AR, null, R.IN, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [3, 5], to: [3, 4] }],
  },
  "Infantry capture defended artillery": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, R.IN, null, null, null, null],
        [null, null, null, null, B.IN, null, null, null],
        [null, null, null, B.AR, R.IN, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [1, 3], to: [2, 3] }],
  },
  "Artillery capture infantry": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, B.IN, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, R.AR, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [6, 4], to: [5, 4] }],
  },
  "Artillery capture artillery": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, B.AR, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, R.HA, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [6, 4], to: [5, 4] }],
  },
  "Airborne capture artillery": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, B.HA, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, R.AB, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [7, 3], to: [2, 3] }],
  },
  "Airborne capture infantry": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, B.IN, null, null, null],
        [null, null, null, null, R.IN, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, R.AB, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [{ from: [7, 3], to: [2, 3] }],
  },
  "Capture on deploy": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, B.IN, R.IN, null, null, null, R.HQ],
      ],
      redReserve: { ...emptyReserveFleet, INFANTRY: 1 },
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [],
  },
  "Infantry capture HQ": {
    boardState: {
      board: [
        [B.HQ, null, R.IN, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, R.IN, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [
      { from: [2, 1], to: [1, 0] },
      { from: [0, 2], to: [0, 1] },
    ],
  },
  "Infantry capture defended HQ": {
    boardState: {
      board: [
        [B.HQ, null, R.IN, R.IN, null, null, null, null],
        [null, B.IN, null, null, null, null, null, null],
        [null, R.IN, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "capturing",
    boardArrows: [],
  },
  "Capture an artillery": {
    boardState: {
      board: [
        [B.HQ, null, null, B.H1, null, B.AR, null, null],
        [B.IN, B.IN, null, null, null, B.IN, null, null],
        [null, null, B.IN, B.AR, null, B.IN, null, null],
        [null, null, B.AI, null, B.IN, null, R.IN, null],
        [null, null, R.IN, null, R.AI, R.IN, null, null],
        [null, null, null, R.AA, null, null, null, null],
        [null, null, null, null, null, R.IN, R.IN, R.IN],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "puzzles",
    boardArrows: [],
  },
  "Capture two infantry": {
    fen: "q2F4/r→7/2f1i3/2I1F3/8/8/8/7Q IIIIIFFFPRRTH iiiiifffprrth r -",
    category: "puzzles",
    boardArrows: [],
  },
  "Capture HQ!": {
    fen: "q1f5/8/IF6/8/8/8/8/6PQ IIIIIFFFPRRTH iiiiifffprrth r -",
    category: "puzzles",
    boardArrows: [],
  },
  "Collapse the center line": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, B.IN, null, null, null, null, null, null],
        [null, null, B.AI, B.AI, B.AI, null, null, null],
        [null, null, R.IN, R.IN, R.IN, null, null, null],
        [null, null, null, null, null, R.AI, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "puzzles",
    boardArrows: [],
  },
  "Avoid being captured next turn": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [null, B.AI, B.A1, B.IN, B.IN, B.A2, null, null],
        [null, null, B.AI, null, null, B.IN, B.IN, null],
        [null, null, null, R.IN, R.AR, R.IN, null, null],
        [null, null, null, null, R.AI, null, null, null],
        [null, null, null, null, R.AI, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "puzzles",
    boardArrows: [],
  },
  "Take back the advantage": {
    boardState: {
      board: [
        [B.HQ, null, null, null, null, null, null, null],
        [B.H1, null, null, null, null, null, null, null],
        [null, null, null, B.A2, B.AI, null, null, null],
        [null, null, B.IN, null, null, R.AI, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, R.IN, R.AI, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "puzzles",
    boardArrows: [],
  },
  "Defend the attack": {
    boardState: {
      board: [
        [B.HQ, B.AR, B.AB, B.AI, null, null, B.AR, null],
        [B.IN, B.IN, null, null, null, null, null, null],
        [null, null, null, null, B.AI, null, null, null],
        [null, null, null, B.IN, B.AA, B.IN, null, null],
        [null, null, null, null, B.H1, null, null, null],
        [null, null, R.AI, null, null, null, R.IN, null],
        [null, R.AI, null, R.A1, null, R.IN, null, R.IN],
        [R.AA, R.AB, R.AI, R.AR, R.IN, R.H1, R.AR, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "puzzles",
    boardArrows: [],
  },
  "HQ vs. HQ and 2 artillery": {
    boardState: {
      board: [
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, R.AR, R.AR, null, null, null],
        [null, null, B.HQ, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "endgames",
    boardArrows: [],
  },
  "HQ vs. HQ, 1 artillery, 1 infantry": {
    boardState: {
      board: [
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, R.AR, R.IN, null, null, null],
        [null, null, B.HQ, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "endgames",
    boardArrows: [],
  },
  "HQ, 2 infantry vs. HQ, 1 infantry": {
    boardState: {
      board: [
        [null, null, null, null, null, null, null, null],
        [null, B.HQ, null, null, null, null, null, null],
        [null, null, B.IN, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, R.IN, R.IN, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "endgames",
    boardArrows: [],
  },
  "HQ, 2 infantry vs. HQ, 1 artillery": {
    boardState: {
      board: [
        [null, null, null, null, null, null, null, null],
        [null, B.HQ, null, null, null, null, null, null],
        [null, null, B.AR, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, R.IN, R.IN, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "endgames",
    boardArrows: [],
  },
  "HQ, 2 infantry vs. HQ, 1 artillery, 1 infantry": {
    boardState: {
      board: [
        [null, null, null, null, null, null, null, null],
        [null, B.HQ, null, null, null, null, null, null],
        [null, B.IN, B.AR, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, R.IN, R.IN, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "endgames",
    boardArrows: [],
  },
  "HQ, 2 artillery vs. HQ, 1 infantry": {
    boardState: {
      board: [
        [null, null, null, null, null, null, null, null],
        [null, B.HQ, null, null, null, null, null, null],
        [null, B.IN, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, R.AR, R.AR, null, null],
        [null, null, null, null, null, null, null, R.HQ],
      ],
      redReserve: emptyReserveFleet,
      blueReserve: emptyReserveFleet,
    },
    category: "endgames",
    boardArrows: [],
  },
  "Classic endgame": {
    boardState: {
      board: endgame.board,
      redReserve: endgame.redReserve,
      blueReserve: endgame.blueReserve,
    },
    category: "endgames",
    boardArrows: [],
  },
};

export type BoardType = keyof typeof boards;

export function newTutorialGHQGame({
  boardState: { board, redReserve, blueReserve },
  isTutorial,
}: {
  boardState: BoardState;
  isTutorial: boolean;
}): Game<GHQState> {
  const game = { ...GHQGame };

  const oldSetup = game.setup;
  game.setup = ({ ctx, ...plugins }, setupData) => {
    if (!oldSetup) throw new Error("No setup function found");
    const state = oldSetup({ ctx, ...plugins }, setupData);
    return {
      ...state,
      isTutorial,
      timeControl: 0,
      redReserve,
      blueReserve,
      board: board,
    };
  };

  return game;
}

export function getBoardInfo(
  boardType?: BoardType,
  fen?: string
): TutorialSetupData | null {
  if (fen) {
    const boardState = FENtoBoardState(fen);
    return { boardState, category: "puzzles", boardArrows: [], fen };
  }

  if (boardType) {
    const data = boards[boardType];

    if (data?.fen) {
      const boardState = FENtoBoardState(data.fen);
      return { ...data, boardState };
    }

    if (!data.fen && !data.boardState) {
      throw new Error("either 'fen' or 'boardState' must be defined");
    }

    if (data.boardState) {
      return { ...data, fen: boardToFEN(data.boardState) };
    }

    return { ...data, fen };
  }

  return null;
}

// https://www.playghq.com/learn?jfen=q1i5/2r%E2%86%99i3r%E2%86%93/6f1/i2r%E2%86%931fh%E2%86%931/I1i1f2I/1R%E2%86%91F5/3R%E2%86%913I/2P1F1R%E2%86%91Q%20II%20IIII
// https://www.playghq.com/learn?jfen=qpi1f1f1/i1r%E2%86%99i1f2/2r%E2%86%931h%E2%86%933/2i1t%E2%86%983/1F1T%E2%86%914/I2R%E2%86%972I1/2I2I1I/1R%E2%86%912PFR%E2%86%91Q%20IIF%20IIIIR

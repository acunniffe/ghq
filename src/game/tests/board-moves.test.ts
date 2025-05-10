import { describe, expect, it } from "@jest/globals";
import { getAllowedMoves } from "@/game/board-moves";
import { FENtoBoardState } from "../notation";
import { allowedMoveToUci } from "../notation-uci";

interface LegalMovesTest {
  description: string;
  boardFEN: string;
  expectedMovesUCI: string;
}

interface MakeMoveTest {
  description: string;
  boardFEN: string;
  moveUCI: string;
  expectedBoardFEN: string;
}

const LEGAL_MOVES_TESTS: LegalMovesTest[] = [
  {
    description: "initial board state",
    boardFEN: "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r",
    expectedMovesUCI:
      "ria1 rib1 ric1 rid1 rie1 rif1 rfa1 rfb1 rfc1 rfd1 rfe1 rff1 rpa1 rpb1 rpc1 rpd1 rpe1 rpf1 rra1 rrb1 rrc1 rrd1 rre1 rrf1 rta1 rtb1 rtc1 rtd1 rte1 rtf1 rha1 rhb1 rhc1 rhd1 rhe1 rhf1 f2e3 f2f3 f2g3 f2e2 f2e1 f2f1 g2f3 g2g3 g2h3 g2f1 h2g3 h2h3 g1f1↑ g1f1↗ g1f1→ g1f1↘ g1f1↓ g1f1↙ g1f1← g1f1↖ g1g1↗ g1g1→ g1g1↘ g1g1↓ g1g1↙ g1g1← g1g1↖",
  },
  {
    description: "airborne infantry capture",
    boardFEN: "q7/8/4h↓3/8/8/8/8/3P3Q - - r",
    expectedMovesUCI:
      "d1b8 d1c8 d1d8 d1e8 d1f8 d1g8 d1h8 d1a7 d1b7 d1c7 d1d7 d1e7 d1e7xe6 d1f7 d1g7 d1h7 d1a6 d1b6 d1c6 d1d6 d1d6xe6 d1f6 d1f6xe6 d1g6 d1h6 d1a5 d1b5 d1c5 d1d5 d1f5 d1g5 d1h5 d1a4 d1b4 d1c4 d1d4 d1f4 d1g4 d1h4 d1a3 d1b3 d1c3 d1d3 d1f3 d1g3 d1h3 d1a2 d1b2 d1c2 d1d2 d1e2 d1f2 d1g2 d1h2 d1a1 d1b1 d1c1 d1e1 d1f1 d1g1 h1g2 h1h2 h1g1",
  },
  {
    description: "infantry capture engaged infantry",
    boardFEN: "q7/8/8/3i4/3II3/8/8/7Q - - r",
    expectedMovesUCI:
      "d4c4 d4c3 d4d3 d4e3 e4e5 e4e5xd5 e4f5 e4f4 e4d3 e4e3 e4f3 h1g2 h1h2 h1g1",
  },
  {
    description: "infantry capture hq",
    boardFEN: "qI6/8/1I6/8/8/8/8/7Q - - r",
    expectedMovesUCI:
      "b8c8 b8a7 b8b7 b8c7 b6a7 b6a7xa8 b6b7 b6c7 b6a6 b6c6 b6a5 b6b5 b6c5 h1g2 h1h2 h1g1",
  },
  {
    description: "infantry in front of artillery",
    boardFEN: "q7/1r↓6/1I↑6/8/8/8/8/7Q IIIIIFFFPRRTH iiiiifffprrth r",
    expectedMovesUCI:
      "ria1 rib1 ric1 rid1 rie1 rif1 rig1 rfa1 rfb1 rfc1 rfd1 rfe1 rff1 rfg1 rpa1 rpb1 rpc1 rpd1 rpe1 rpf1 rpg1 rra1 rrb1 rrc1 rrd1 rre1 rrf1 rrg1 rta1 rtb1 rtc1 rtd1 rte1 rtf1 rtg1 rha1 rhb1 rhc1 rhd1 rhe1 rhf1 rhg1 b6a7 b6a7xb7 b6c7 b6c7xb7 b6a6 b6c6 b6a5 b6c5 h1g2 h1h2 h1g1",
  },
];

const MAKE_MOVE_TESTS: MakeMoveTest[] = [
  {
    description: "infantry capture engaged infantry",
    boardFEN: "q7/8/8/3i4/3II3/8/8/7Q - - r",
    moveUCI: "e4e5xd5",
    expectedBoardFEN: "q7/8/8/4I3/3I4/8/8/7Q - - r",
  },
];

describe("legal moves", () => {
  for (const test of LEGAL_MOVES_TESTS) {
    it(test.description, () => {
      const board = FENtoBoardState(test.boardFEN);
      const moves = getAllowedMoves({
        board: board.board,
        redReserve: board.redReserve,
        blueReserve: board.blueReserve,
        currentPlayerTurn: board.currentPlayerTurn ?? "RED", // TODO(tyler): this should come from the FEN
        thisTurnMoves: [],
      });

      const expectedMoves = test.expectedMovesUCI.split(" ");
      const actualMoves = moves.map(allowedMoveToUci);

      // console.log(actualMoves.join(" "));

      expect(actualMoves.length).toEqual(expectedMoves.length);
      expect(actualMoves).toEqual(expect.arrayContaining(expectedMoves));
    });
  }
});

describe("making moves", () => {
  for (const test of MAKE_MOVE_TESTS) {
    it(test.description, () => {
      const board = FENtoBoardState(test.boardFEN);
      const moves = getAllowedMoves({
        board: board.board,
        redReserve: board.redReserve,
        blueReserve: board.blueReserve,
        currentPlayerTurn: board.currentPlayerTurn ?? "RED", // TODO(tyler): this should come from the FEN
        thisTurnMoves: [],
      });

      const actualMoves = moves.map(allowedMoveToUci);
      expect(actualMoves).toContain(test.moveUCI);

      // TODO(tyler): add ability to test our boardgame.io game state
    });
  }
});

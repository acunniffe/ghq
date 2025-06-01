import { describe, expect, it } from "@jest/globals";
import { BoardState, boardToFEN, FENtoBoardState } from "./notation";
import { boards } from "./tutorial";
import { defaultBoard, defaultReserveFleet } from "./engine";

const notations = [
  "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r",
  "q7/8/4h↓3/8/8/8/8/3P3Q - - r",
  "qI6/8/1I6/8/8/8/8/7Q - - r",
  "q7/8/8/3i4/3II3/8/8/7Q - - r",
  "q7/1r↓6/1I6/8/8/8/8/7Q IIIIIFFFPRRTH iiiiifffprrth r",
  "8/8/1i6/2r↓5/1I6/8/8/8 - - r",
  "8/8/1i6/r↓1r↓5/8/8/8/1P6 - - r",
  "8/8/1i6/1Ii5/8/8/8/1P6 - - r",
  "8/8/1i6/1Ir↓5/2I5/8/8/1P6 - - r",
  "qr↓6/iii5/8/8/8/8/5III/4P1R↑Q - - r",
  "qr↓1p4/iii5/8/8/8/8/5III/6R↑Q - - r",
  "8/1iI5/1I1I4/8/8/8/8/8 - - r",
  "8/1i6/8/1Ii5/8/8/8/8 - - r",
  "8/8/1iI5/1Ii1iI2/Ii1I4/8/8/8 - - r",
  "8/8/1iI5/1IiI4/I1Ii4/1ii5/8/8 - - r",
  "8/2R↑5/1R↑6/3i4/8/8/8/8 - - r",
  "1p6/8/8/1Ii5/8/8/8/8 - - r",
  "1f6/8/8/1Ii5/8/8/8/8 - - r",
  "1f6/8/8/1Qi5/8/8/8/8 - - r",
  "8/1i6/8/1Q6/8/8/8/8 - - r",
  "p7/8/8/8/8/8/6R↑1/7Q - - r",
  "8/8/8/8/7i/6i1/7P/7q - - r",
  "8/8/8/8/8/8/6iq/6I1 - - r",
  "8/8/8/8/8/8/7R↑/5I1q - - r",
  "I7/1p6/1If5/8/8/8/8/8 - - r",
  "8/8/8/8/4r←3/4I3/8/8 - - r",
  "8/8/8/8/4r←3/4I3/8/8 - - r",
  "8/8/8/8/4r→3/4I3/8/8 - - r",
  "8/8/8/8/4r→3/4I3/8/8 - - r",
  "8/8/8/8/3Ir↑3/8/8/8 - - r",
  "8/8/8/8/3Ir↑3/8/8/8 - - r",
  "8/8/8/8/3Ir↓3/8/8/8 - - r",
  "8/8/8/8/3Ir↓3/8/8/8 - - r",
  "8/8/8/8/3Iq3/8/8/8 - - r",
  "8/8/5i2/6R↑i/5IiI/8/8/8 - - r",
  "q7/8/8/8/8/8/8/1I5Q - - r",
  "q7/8/8/8/8/8/I7/7Q - - r",
  "q7/8/8/8/8/8/I7/F6Q - - r",
  "q7/8/8/8/8/8/I7/T↑6Q - - r",
  "qr6/F7/8/8/8/8/8/7Q - - r",
  "1r↘6/q7/1F6/8/8/8/8/7Q - - r",
  "q7/8/8/8/8/r↓7/8/7Q I - r",
  "q7/8/1i6/2fff3/2III3/5F2/8/7Q - - r",
  "q7/8/8/8/8/3f4/3F4/7Q - - r",
  "q7/8/3i4/8/2Ir↓f3/3I4/8/7Q - - r",
  "q7/8/8/2i5/3r↓I3/1I6/8/7Q - - r",
  "q7/8/8/8/8/1i6/8/T↑6Q - - r",
  "q5i1/8/7T↗/8/8/8/6Q1/8 - - b",
  "q5i1/8/6T↗1/8/8/8/6Q1/8 - - b",
  "q5i1/5i2/8/5H↗2/8/8/8/7Q - - b",
  "1IiIi3/1iIi4/3I4/2IqIi2/2fI1I2/3iIi2/8/7Q - - r",
  "1IiIi3/1iIi4/3I4/2IqIi2/2fI1I2/3iIi2/8/7Q - - r",
];

describe("fen", () => {
  for (const [boardName, { boardState }] of Object.entries(boards)) {
    it("can represent board state for: " + boardName, () => {
      const fen = boardToFEN(boardState);
      const newBoard = FENtoBoardState(fen);
      if (!boardState.currentPlayerTurn) {
        delete newBoard.currentPlayerTurn;
      }
      expect(newBoard).toEqual(boardState);
    });
  }

  it("represents the initial board state", () => {
    const boardState: BoardState = {
      board: defaultBoard,
      redReserve: defaultReserveFleet,
      blueReserve: defaultReserveFleet,
      currentPlayerTurn: "RED",
    };
    const fen = boardToFEN(boardState);
    expect(fen).toEqual(
      "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r"
    );
    const newBoard = FENtoBoardState(fen);
    expect(newBoard).toEqual(boardState);
  });

  for (const notation of notations) {
    it("can represent notation: " + notation, () => {
      const boardState = FENtoBoardState(notation);
      const fen = boardToFEN(boardState);
      expect(notation).toEqual(fen);
    });
  }
});

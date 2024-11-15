import { describe, expect, it } from "@jest/globals";
import { boardToFEN, FENtoBoardState } from "./notation";
import { boards } from "./tutorial";
import { defaultBoard, defaultReserveFleet, ReserveFleet } from "./engine";

describe("fen", () => {
  for (const [boardName, { boardState }] of Object.entries(boards)) {
    it("can represent board state for: " + boardName, () => {
      const fen = boardToFEN(boardState);
      const newBoard = FENtoBoardState(fen);
      expect(newBoard).toEqual(boardState);
    });
  }

  it("represents the initial board state", () => {
    const boardState = {
      board: defaultBoard,
      redReserve: defaultReserveFleet,
      blueReserve: defaultReserveFleet,
    };
    const fen = boardToFEN(boardState);
    expect(fen).toEqual(
      "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH IIIIIFFFPRRTH"
    );
    const newBoard = FENtoBoardState(fen);
    expect(newBoard).toEqual(boardState);
  });
});

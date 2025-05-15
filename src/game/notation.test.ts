import { describe, expect, it } from "@jest/globals";
import { BoardState, boardToFEN, FENtoBoardState } from "./notation";
import { boards } from "./tutorial";
import { defaultBoard, defaultReserveFleet } from "./engine";

describe("fen", () => {
  for (const [boardName, { boardState }] of Object.entries(boards)) {
    it("can represent board state for: " + boardName, () => {
      const fen = boardToFEN(boardState);
      const newBoard = FENtoBoardState(fen);
      if (!boardState.currentPlayerTurn) {
        delete newBoard.currentPlayerTurn;
      }
      if (!boardState.thisTurnMoves) {
        delete newBoard.thisTurnMoves;
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
      thisTurnMoves: [],
    };
    const fen = boardToFEN(boardState);
    expect(fen).toEqual(
      "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r -"
    );
    const newBoard = FENtoBoardState(fen);
    expect(newBoard).toEqual(boardState);
  });
});

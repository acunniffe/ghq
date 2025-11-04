import {
  AllowedMove,
  Coordinate,
  GHQState,
  Player,
  ReserveFleet,
  type Square,
} from "@/game/engine";
import {
  isBombardedBy,
  isPieceArtillery,
  PlayerPiece,
} from "../../game/board-moves";

import { areCoordsEqual } from "../../game/capture-logic";

/**
 * The state of the user's actions on the board.
 *
 * 1. User selects a piece on the board or a reserve piece (selectedPiece or selectedReserve)
 *    Once they have a selected piece, we can show the "candidateMoves" for that piece.
 *    The "candidateMoves" are the "first level" of moves, such as moving a piece to a new location.
 *
 * 2. User selects a move from the candidate moves.
 *    Once they have chosen one of the candidate moves, we can show the "chosenMoves" for that piece.
 *    The "chosenMoves" are the "second level" of moves, such as rotating a piece or capturing.
 *
 * 3. User selects a single chosen move, which is passed to the game state..
 *
 */
export interface UserActionState {
  // The piece at a given coordinate that the user has selected that they want to move.
  selectedPiece?: PlayerPiece;

  // The reserve piece that the user has selected that they want to place.
  selectedReserve?: keyof ReserveFleet;

  // Allows us to track if the user is currently dragging the mouse.
  isMouseDown?: boolean;

  // The coordinate that the user is currently hovering over. This is largely used for rendering purposes.
  hoveredCoordinate?: Coordinate;

  // The possible moves that the user can make with the selected piece.
  // This is the "first level" of moves, such as moving a piece to a new location.
  candidateMoves?: AllowedMove[];

  // This is the subset of candidate moves that the user has chosen to make.
  // This is the "second level" of moves, such as rotating a piece or capturing.
  chosenMoves?: AllowedMove[];

  // The final move that the user has chosen to make, which is the move that will be passed to the game state.
  chosenMove?: AllowedMove;
}

export function updateClick(
  self: UserActionState,
  board: GHQState["board"],
  square: Square,
  [rowIndex, colIndex]: Coordinate,
  possibleAllowedMoves: AllowedMove[],
  currentPlayer: Player,
  currentPlayerTurn: Player,
  isMouseDown: boolean,
  hasMoveLimitReached: boolean
): UserActionState {
  // You can only play on your turn.
  if (currentPlayer !== currentPlayerTurn || hasMoveLimitReached) {
    return self;
  }

  // If this is a free auto-capture move, then we should just return the move.
  if (
    possibleAllowedMoves.some(
      (move) =>
        move.name === "AutoCapture" &&
        (move.args[0] === "free" || move.args[0] === "bombard") &&
        areCoordsEqual(move.args[1], [rowIndex, colIndex])
    )
  ) {
    return {
      chosenMove: possibleAllowedMoves.find(
        (move) =>
          move.name === "AutoCapture" &&
          (move.args[0] === "free" || move.args[0] === "bombard") &&
          areCoordsEqual(move.args[1], [rowIndex, colIndex])
      ),
    };
  }

  // If we have chosen candidates already, then the user is attempting to finalize their move, let's lock it in.
  const chosenMove = self.chosenMoves?.find(
    (move) =>
      (move.name === "Move" &&
        areCoordsEqual(move.args[2] ?? [-1, -1], [rowIndex, colIndex])) ||
      (move.name === "MoveAndOrient" &&
        isBombardedBy(board, move.args[0], move.args[1], move.args[2], [
          rowIndex,
          colIndex,
        ]).isBombarded) ||
      (move.name === "Reinforce" &&
        areCoordsEqual(move.args[2] ?? [-1, -1], [rowIndex, colIndex]))
  );
  if ((self.selectedPiece || self.selectedReserve) && chosenMove) {
    return {
      chosenMove,
    };
  }

  const choseCandidateMoves =
    self.candidateMoves?.filter(
      (move) =>
        (move.name === "Move" &&
          areCoordsEqual(move.args[1], [rowIndex, colIndex])) ||
        (move.name === "MoveAndOrient" &&
          areCoordsEqual(move.args[1], [rowIndex, colIndex])) ||
        (move.name === "Reinforce" &&
          areCoordsEqual(move.args[1], [rowIndex, colIndex]))
    ) ?? [];

  // If a move was already chosen out of a possible set of one moves, then we should play that move.
  if (
    (self.selectedPiece || self.selectedReserve) &&
    choseCandidateMoves.length === 1
  ) {
    return {
      chosenMove: choseCandidateMoves[0],
    };
  }

  // If there are multiple possible moves, then we need to provide the user with a choice.
  // Note: If the piece is an artillery piece and mouse is still down, we need to skip this step,
  //       otherwise we'll always default to keeping this piece in the same place.
  const skipChosenMoves =
    square && isPieceArtillery(square) && self.isMouseDown;
  if (
    (self.selectedPiece || self.selectedReserve) &&
    choseCandidateMoves.length > 1 &&
    !skipChosenMoves
  ) {
    return {
      ...self,
      chosenMoves: choseCandidateMoves,
    };
  }

  // If the clicked square contains a piece, and it's the current player's piece, then we should show the possible moves.
  if (square && square.player === currentPlayer) {
    const coordinate: Coordinate = [rowIndex, colIndex];
    const candidateMoves =
      possibleAllowedMoves.filter(
        (move) =>
          (move.name === "Move" && areCoordsEqual(coordinate, move.args[0])) ||
          (move.name === "MoveAndOrient" &&
            areCoordsEqual(coordinate, move.args[0])) ||
          (move.name === "Reinforce" &&
            areCoordsEqual(coordinate, move.args[1]))
      ) ?? [];

    // If this is the currently selected piece, then we should clear the state.
    // *Unless* the user was dragging the mouse, in which case we should keep the state.
    if (
      self.selectedPiece &&
      areCoordsEqual(self.selectedPiece.coordinate, coordinate) &&
      !self.isMouseDown &&
      !isMouseDown
    ) {
      return { isMouseDown };
    }

    // If we just chose a move, then we should clear the state.
    // This can happen because the user finished their move with a click.
    if (self.chosenMove && !isMouseDown) {
      return { isMouseDown };
    }

    return {
      isMouseDown,
      candidateMoves,
      selectedPiece: {
        piece: square,
        coordinate: [rowIndex, colIndex],
      },
    };
  }

  // Otherwise, we should clear the state.
  return {};
}

export function updateHover(
  self: UserActionState,
  [rowIndex, colIndex]: Coordinate
): UserActionState {
  return {
    ...self,
    hoveredCoordinate: [rowIndex, colIndex],
  };
}

export function updateReserveClick(
  self: UserActionState,
  kind: keyof ReserveFleet,
  possibleAllowedMoves: AllowedMove[],
  isMouseDown: boolean
): UserActionState {
  const candidateMoves =
    possibleAllowedMoves.filter(
      (move) => move.name === "Reinforce" && move.args[0] === kind
    ) ?? [];
  return {
    candidateMoves,
    isMouseDown,
    selectedReserve: kind,
  };
}

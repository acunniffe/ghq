"use client";

import React, { useCallback, useMemo } from "react";
import {
  AllowedMove,
  AnimatedMove,
  Coordinate,
  Player,
  type Board,
} from "@/game/engine";
import { bombardedSquares } from "@/game/move-logic";
import { updateClick, updateHover, UserActionState } from "./state";
import Square, { getSquareState } from "./Square";
import BoardArrow from "@/game/BoardArrow";
import classNames from "classnames";
import BoardContainer from "./BoardContainer";
import useRightClick from "./useRightClick";
import { getBoardEngagements } from "@/game/capture-logic";
import PieceMouse from "./PieceMouse";
import { GameClient } from "@/game/engine-v2";
import { PlayerPiece } from "@/game/board-moves";

export default function Board({
  game,
  board,
  mostRecentMove,
  userActionState,
  setUserActionState,
  possibleAllowedMoves,
  currentPlayer,
  currentPlayerTurn,
  isFlipped,
  measureRef,
  squareSize,
  pieceSize,
}: {
  game: GameClient;
  board: Board;
  mostRecentMove: AnimatedMove | undefined;
  currentPlayer: Player;
  currentPlayerTurn: Player;
  userActionState: UserActionState;
  setUserActionState: React.Dispatch<React.SetStateAction<UserActionState>>;
  possibleAllowedMoves: AllowedMove[];
  isFlipped: boolean;
  measureRef: (instance: Element | null) => void;
  squareSize: number;
  pieceSize: number;
}) {
  const bombarded = useMemo(() => bombardedSquares(board), [board]);
  const recentMoves: Coordinate[] = useMemo(
    () =>
      [...game.getLastTurnMoves(), ...game.getThisTurnMoves()]
        .map((move) => move.args[1])
        .filter((square) => square !== undefined),
    [game.moves, game.turn]
  );
  const recentCaptures: PlayerPiece[] = useMemo(
    () => game.getRecentCaptures(),
    [game.moves, game.turn]
  );
  const hasMoveLimitReached = useMemo(
    () => game.hasMoveLimitReached(),
    [game.moves, game.turn]
  );

  const { boardArrows, rightClicked, handleRightClickDrag, clearRightClick } =
    useRightClick({ board });

  const handleLeftClick = useCallback(
    ([rowIndex, colIndex]: Coordinate, isMouseDown: boolean) => {
      if (game.gameover) {
        return;
      }

      const square = board[rowIndex][colIndex];
      setUserActionState((userActionState) =>
        updateClick(
          userActionState,
          board,
          square,
          [rowIndex, colIndex],
          possibleAllowedMoves,
          currentPlayer,
          currentPlayerTurn,
          isMouseDown,
          hasMoveLimitReached
        )
      );

      clearRightClick();
    },
    [board, possibleAllowedMoves, game.turn, game.moves, hasMoveLimitReached]
  );

  const handleMouseOver = useCallback(([rowIndex, colIndex]: Coordinate) => {
    setUserActionState((userActionState) =>
      updateHover(userActionState, [rowIndex, colIndex])
    );
  }, []);

  const boardEngagements = useMemo(
    () =>
      getBoardEngagements(board, userActionState?.selectedPiece?.coordinate),
    [board, userActionState.selectedPiece, game.turn, game.moves]
  );

  return (
    <>
      <BoardContainer
        ref={measureRef}
        onRightClickDrag={handleRightClickDrag}
        onLeftClickDown={(coord) => handleLeftClick(coord, true)}
        onLeftClickUp={(coord) => handleLeftClick(coord, false)}
        onMouseOver={handleMouseOver}
        flipped={isFlipped}
        isTutorial={game.isTutorial}
      >
        {board.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: "flex" }}>
            {row.map((square, colIndex) => (
              <div key={colIndex}>
                <Square
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  squareState={getSquareState({
                    currentPlayer,
                    board,
                    bombarded,
                    mostRecentMove,
                    recentMoves,
                    recentCaptures,
                    rowIndex,
                    colIndex,
                    square,
                    userActionState,
                    rightClicked,
                    boardEngagements,
                    allowedMoves: possibleAllowedMoves,
                  })}
                  isFlipped={isFlipped}
                />
              </div>
            ))}
          </div>
        ))}
        {boardArrows.map((boardArrow) => (
          <BoardArrow
            key={`${boardArrow.from[0]},${boardArrow.from[1]}-${boardArrow.to[0]},${boardArrow.to[1]}`}
            squareSize={squareSize}
            from={boardArrow.from}
            to={boardArrow.to}
            className={classNames("fill-green-600 stroke-green-600")}
          />
        ))}
      </BoardContainer>
      <PieceMouse
        userActionState={userActionState}
        pieceSize={pieceSize}
        currentPlayer={currentPlayer}
      />
    </>
  );
}

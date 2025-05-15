"use client";

import React, { useCallback, useMemo } from "react";
import {
  AllowedMove,
  Coordinate,
  GHQState,
  Player,
  type Board,
} from "@/game/engine";
import { bombardedSquares } from "@/game/move-logic";
import { useMeasure } from "@uidotdev/usehooks";
import { pieceSizes, squareSizes } from "@/game/constants";
import { updateClick, updateHover, UserActionState } from "./state";
import Square, { getSquareState } from "./Square";
import BoardArrow from "@/game/BoardArrow";
import classNames from "classnames";
import BoardContainer from "./BoardContainer";
import useRightClick from "./useRightClick";
import { getBoardEngagements, getRecentCaptures } from "@/game/capture-logic";
import { Ctx, LogEntry } from "boardgame.io";
import PieceMouse from "./PieceMouse";

export default function Board({
  ctx,
  G,
  log,
  board,
  mostRecentMove,
  userActionState,
  setUserActionState,
  possibleAllowedMoves,
  currentPlayer,
  currentPlayerTurn,
  isFlipped,
}: {
  G: GHQState;
  ctx: Ctx;
  log: LogEntry[];
  board: Board;
  mostRecentMove: AllowedMove | undefined;
  currentPlayer: Player;
  currentPlayerTurn: Player;
  userActionState: UserActionState;
  setUserActionState: React.Dispatch<React.SetStateAction<UserActionState>>;
  possibleAllowedMoves: AllowedMove[];
  isFlipped: boolean;
}) {
  const { measureRef, squareSize, pieceSize } = useBoardDimensions(
    G.isTutorial
  );

  const bombarded = useMemo(() => bombardedSquares(board), [board]);
  const recentMoves = useMemo(
    () => [...G.lastTurnMoves["0"], ...G.lastTurnMoves["1"]],
    [board]
  );
  const recentCaptures = useMemo(
    () =>
      getRecentCaptures({ turn: ctx.turn, systemMessages: G.historyLog, log }),
    [board]
  );

  const { boardArrows, rightClicked, handleRightClickDrag, clearRightClick } =
    useRightClick({ board });

  const handleLeftClick = useCallback(
    ([rowIndex, colIndex]: Coordinate, isMouseDown: boolean) => {
      if (ctx.gameover) {
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
          isMouseDown
        )
      );

      clearRightClick();
    },
    [board, possibleAllowedMoves, ctx.gameover]
  );

  const handleMouseOver = useCallback(([rowIndex, colIndex]: Coordinate) => {
    setUserActionState((userActionState) =>
      updateHover(userActionState, [rowIndex, colIndex])
    );
  }, []);

  const boardEngagements = useMemo(
    () =>
      getBoardEngagements(board, userActionState?.selectedPiece?.coordinate),
    [board, userActionState.selectedPiece]
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
        isTutorial={G.isTutorial}
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
                    mostRecentMove,
                    recentMoves,
                    recentCaptures,
                    rowIndex,
                    colIndex,
                    square,
                    bombarded,
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

function useBoardDimensions(isTutorial: boolean) {
  const [measureRef, { width, height }] = useMeasure();

  const [squareSize, pieceSize] = useMemo(() => {
    const smallestDim: number = Math.min(width || 0, height || 0);
    if (smallestDim && smallestDim - squareSizes.large * 8 >= 0) {
      return [squareSizes.large, pieceSizes.large];
    } else {
      return [squareSizes.small, pieceSizes.small];
    }
  }, [width, height]);

  if (isTutorial) {
    return {
      measureRef,
      squareSize: squareSizes.small,
      pieceSize: pieceSizes.small,
    };
  }

  return { measureRef, squareSize, pieceSize };
}

/* eslint-disable @next/next/no-img-element */
"use client";

import React, { Ref, useEffect, useRef, useState } from "react";
import {
  AllowedMove,
  Board,
  Coordinate,
  NonNullSquare,
  Orientation,
  Player,
  type Square,
  Units,
} from "@/game/engine";
import classNames from "classnames";
import { Bombarded, bombardedSquares } from "@/game/move-logic";
import { Crosshair } from "lucide-react";
import {
  isBombardedBy,
  isPieceArtillery,
  PlayerPiece,
} from "../../game/board-moves";

import { areCoordsEqual, BoardEngagements } from "../../game/capture-logic";
import { UserActionState } from "./state";
import BoardCoordinateLabels from "./BoardCoordinateLabels";

interface AnimateTo {
  coordinate: Coordinate;
  orientation?: Orientation;
}

export interface SquareState {
  rowIndex: number;
  colIndex: number;
  square: Square;
  stagedSquare: Square;
  isRedBombarded: boolean;
  isBlueBombarded: boolean;
  isSelected: boolean;
  isCaptureCandidate: boolean;
  isBombardCandidate: boolean;
  showTarget: boolean;
  wasRecentlyCapturedPiece: NonNullSquare | undefined;
  wasRecentlyMovedTo: boolean;
  isMovable: boolean;
  isRightClicked: boolean;
  isHovered: boolean;
  isMidMove: boolean;
  shouldAnimateTo: AnimateTo | undefined;
  engagedOrientation: Orientation | undefined;
}

export function getSquareState({
  currentPlayer,
  board,
  mostRecentMove,
  recentMoves,
  recentCaptures,
  square,
  rowIndex,
  colIndex,
  bombarded,
  userActionState,
  rightClicked,
  boardEngagements,
  allowedMoves,
}: {
  currentPlayer: Player;
  board: Board;
  mostRecentMove: AllowedMove | undefined;
  recentMoves: Coordinate[];
  recentCaptures: PlayerPiece[];
  rowIndex: number;
  colIndex: number;
  square: Square;
  bombarded: Bombarded;
  userActionState: UserActionState | null;
  rightClicked: Set<string>;
  boardEngagements: BoardEngagements;
  allowedMoves: AllowedMove[];
}): SquareState {
  // TODO(tyler): add allowed moves so we can check if there are start of turn free captures
  const coord: Coordinate = [rowIndex, colIndex];
  const hoveredCoord = userActionState?.hoveredCoordinate ?? [-1, -1];
  const { isMovable, isCaptureCandidate } = getMoveAndCaptureCandidates(
    coord,
    allowedMoves,
    userActionState?.candidateMoves,
    userActionState?.chosenMoves,
    userActionState?.hoveredCoordinate
  );
  const { isSelected, isMidMove, stagedSquare, isBombardCandidate } =
    getChosenCandidates(coord, userActionState, board, currentPlayer);
  const wasRecentlyMovedTo = recentMoves.some((moveCoord) =>
    areCoordsEqual(coord, moveCoord)
  );
  const wasRecentlyCapturedPiece = recentCaptures.findLast((cap) =>
    areCoordsEqual(coord, cap.coordinate)
  )?.piece;
  const { shouldAnimateTo } = getAnimation(coord, mostRecentMove);
  const engagedOrientation = getEngagedOrientation(coord, boardEngagements);
  const { isRedBombarded, isBlueBombarded } = getBombardStatus(
    board,
    coord,
    userActionState,
    bombarded
  );

  return {
    rowIndex,
    colIndex,
    square,
    stagedSquare,
    isRedBombarded,
    isBlueBombarded,
    isSelected,
    showTarget: false,
    wasRecentlyCapturedPiece,
    wasRecentlyMovedTo,
    isMovable,
    isCaptureCandidate,
    isBombardCandidate,
    isRightClicked: rightClicked.has(`${rowIndex},${colIndex}`),
    isHovered: areCoordsEqual(coord, hoveredCoord),
    isMidMove,
    shouldAnimateTo,
    engagedOrientation,
  };
}

export default function Square({
  squareSize,
  pieceSize,
  squareState,
  isFlipped,
}: {
  squareSize: number;
  pieceSize: number;
  squareState: SquareState;
  isFlipped: boolean; // In general, the square shouldn't care whether it's flipped. We only need to know this for the coordinate labels.
}) {
  const {
    rowIndex,
    colIndex,
    square,
    stagedSquare,
    shouldAnimateTo,
    wasRecentlyCapturedPiece,
  } = squareState;
  const displaySquare = stagedSquare ?? square ?? wasRecentlyCapturedPiece;
  const animationRef: Ref<HTMLImageElement> = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);

  function getTransform() {
    if (shouldAnimateTo) {
      const [toRow, toCol] = shouldAnimateTo.coordinate;
      const [fromRow, fromCol] = [rowIndex, colIndex];
      const deltaX = (toCol - fromCol) * squareSize;
      const deltaY = (toRow - fromRow) * squareSize;

      return `translate(${deltaX}px, ${deltaY}px) rotate(${
        shouldAnimateTo.orientation ?? 0
      }deg)`;
    }

    return `translate(0px, 0px) rotate(${displaySquare?.orientation ?? 0}deg)`;
  }

  useEffect(() => {
    if (
      !isAnimating &&
      animationRef.current &&
      displaySquare &&
      shouldAnimateTo
    ) {
      setIsAnimating(true);
      animationRef.current.style.position = "absolute";
      animationRef.current.style.zIndex = "50";
      const animation = animationRef.current.animate(
        [
          {
            transform: "translate(0px, 0px)",
          },
          { transform: getTransform() },
        ],
        {
          duration: 250,
          easing: "ease-out",
        }
      );

      animation.onfinish = () => {
        setIsAnimating(false);
        if (animationRef.current) {
          animationRef.current.style.position = "relative";
          animationRef.current.style.zIndex = "1";
        }
      };
    }
  }, [shouldAnimateTo]);

  return (
    <div
      style={{
        width: squareSize,
        height: squareSize,
      }}
      data-row-index={rowIndex}
      data-col-index={colIndex}
      key={`${rowIndex},${colIndex}`}
      className={classNames(
        "relative flex items-center justify-center select-none font-bold text-3xl"
      )}
    >
      <SquareBackground squareState={squareState} />
      <BoardCoordinateLabels
        isFlipped={isFlipped}
        colIndex={colIndex}
        rowIndex={rowIndex}
      />
      {displaySquare && (
        <div ref={animationRef} className="pointer-events-none">
          <img
            className={classNames("pointer-events-none", {
              "opacity-25": squareState.isMidMove,
              "opacity-75": squareState.stagedSquare,
              "opacity-20 filter grayscale":
                squareState.wasRecentlyCapturedPiece && !square,
            })}
            src={`/${
              Units[displaySquare.type].imagePathPrefix
            }-${displaySquare.player.toLowerCase()}.png`}
            width={pieceSize}
            height={pieceSize}
            draggable="false"
            style={{
              transform: `rotate(${getRotationForPiece(
                displaySquare,
                squareState
              )}deg)`,
              transition: "transform 0.1s",
            }}
            alt={Units[displaySquare.type].imagePathPrefix}
          />
        </div>
      )}
    </div>
  );
}

function getRotationForPiece(
  square: NonNullSquare,
  squareState: SquareState
): number {
  if (isPieceArtillery(square)) {
    return square.orientation ?? 0;
  }

  if (squareState.engagedOrientation !== undefined) {
    return squareState.engagedOrientation;
  }

  return square.player === "BLUE" ? 180 : 0;
}

function SquareBackground({ squareState }: { squareState: SquareState }) {
  let baseBackground =
    (squareState.rowIndex + squareState.colIndex) % 2 === 0
      ? "bg-slate-400/70"
      : "bg-slate-200";

  if (squareState.isRedBombarded && squareState.isBlueBombarded) {
    baseBackground = "stripe-red-blue";
  } else if (squareState.isRedBombarded) {
    baseBackground = "stripe-red-transparent";
  } else if (squareState.isBlueBombarded) {
    baseBackground = "stripe-blue-transparent";
  }

  return (
    <>
      <SquareBackgroundColor className={baseBackground} />
      {squareState.isCaptureCandidate && (
        <>
          <SquareBackgroundColor
            className={classNames("z-10", {
              "bg-red-400/60": !squareState.isHovered,
              "bg-red-800/80": squareState.isHovered,
            })}
          />
          <Crosshair className="absolute z-10 text-red-200 w-1/2 h-1/2 pointer-events-none" />
        </>
      )}
      {squareState.wasRecentlyMovedTo && (
        <SquareBackgroundColor className="bg-yellow-300/30" />
      )}
      {squareState.wasRecentlyCapturedPiece && (
        <SquareBackgroundColor className="bg-red-300/30" />
      )}
      {squareState.isSelected && (
        <SquareBackgroundColor className="bg-green-800/50" />
      )}
      {squareState.isRightClicked && (
        <SquareBackgroundColor className="bg-green-600/50" />
      )}
      {squareState.isMovable &&
        (squareState.isHovered ? (
          <SquareBackgroundColor className="bg-green-800/50" />
        ) : (
          <div className="absolute rounded-full bg-green-700/50 w-1/3 h-1/3 pointer-events-none"></div>
        ))}
      {squareState.isBombardCandidate &&
        (squareState.isHovered ? (
          <SquareBackgroundColor className="bg-yellow-600/80 z-10" />
        ) : (
          <div
            className={
              "absolute rounded-full bg-yellow-400/80 w-1/3 h-1/3 pointer-events-none z-10"
            }
          ></div>
        ))}
    </>
  );
}

function SquareBackgroundColor({ className }: { className: string }) {
  return (
    <div
      className={classNames(
        "absolute w-full h-full top-0 left-0 pointer-events-none",
        className
      )}
    ></div>
  );
}

function getOrientationBetween(from: Coordinate, to: Coordinate): Orientation {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;

  if (fromRow === toRow) {
    return toCol > fromCol ? 90 : 270;
  } else if (fromCol === toCol) {
    return toRow > fromRow ? 180 : 0;
  } else if (toRow > fromRow && toCol > fromCol) {
    return 135;
  } else if (toRow > fromRow && toCol < fromCol) {
    return 225;
  } else if (toRow < fromRow && toCol > fromCol) {
    return 45;
  } else {
    return 315;
  }
}

function getMoveDestination(move: AllowedMove): Coordinate | undefined {
  if (["Move", "MoveAndOrient", "Reinforce"].includes(move.name)) {
    return move.args[1];
  }
  if (move.name === "AutoCapture" && move.args[0] === "free") {
    return move.args[2];
  }
  return undefined;
}

function getCaptureLocation(move: AllowedMove): Coordinate | undefined {
  if (move.name === "Reinforce") {
    return move.args[2];
  }
  return move.name === "Move" ? move.args[2] : undefined;
}

function getMoveAndCaptureCandidates(
  coord: Coordinate,
  allowedMoves: AllowedMove[],
  candidateMoves: AllowedMove[] = [],
  chosenMoves: AllowedMove[] = [],
  hoveredCoordinate?: Coordinate
) {
  let isMovable = false;
  let isCaptureCandidate = false;

  // #perf-improvement-possible: candidateMoves could be a set
  for (const move of candidateMoves) {
    const moveDestination = getMoveDestination(move);

    if (moveDestination && areCoordsEqual(coord, moveDestination)) {
      isMovable = true;
    }

    if (
      moveDestination &&
      hoveredCoordinate &&
      areCoordsEqual(moveDestination, hoveredCoordinate)
    ) {
      const captureLocation = getCaptureLocation(move);
      if (captureLocation && areCoordsEqual(coord, captureLocation)) {
        isCaptureCandidate = true;
      }
    }
  }

  for (const move of chosenMoves) {
    const captureLocation = getCaptureLocation(move);
    if (captureLocation && areCoordsEqual(coord, captureLocation)) {
      isCaptureCandidate = true;
    }
  }

  for (const move of allowedMoves) {
    if (
      move.name === "AutoCapture" &&
      move.args[0] === "free" &&
      areCoordsEqual(coord, move.args[1])
    ) {
      isCaptureCandidate = true;
    }
  }

  return { isMovable, isCaptureCandidate };
}

function getMoveOrigin(move: AllowedMove): Coordinate | undefined {
  if (move.name === "Move" || move.name === "MoveAndOrient") {
    return move.args[0];
  }
  if (move.name === "AutoCapture" && move.args[0] === "free") {
    return move.args[1];
  }
  return undefined;
}

function getChosenCandidates(
  coord: Coordinate,
  userActionState: UserActionState | null,
  board: Board,
  currentPlayer: Player
) {
  const selectedCoord = userActionState?.selectedPiece?.coordinate ?? [-1, -1];

  let isSelected = areCoordsEqual(coord, selectedCoord);
  let isMidMove = false;
  let stagedSquare = null;
  let isBombardCandidate = false;

  // #perf-improvement-possible: chosenMoves could be a set
  for (const move of userActionState?.chosenMoves ?? []) {
    const moveOrigin = getMoveOrigin(move);

    // If the square is the origin of the move, then it's considered "mid-move" and becomes de-emphasized.
    if (moveOrigin && areCoordsEqual(coord, moveOrigin)) {
      isMidMove = true;
      isSelected = false;
    }

    let originPiece = moveOrigin
      ? JSON.parse(JSON.stringify(board[moveOrigin[0]][moveOrigin[1]]))
      : null;

    // If the current move is to Reinforce, then generate the origin piece.
    if (move.name === "Reinforce") {
      const type = move.args[0];
      originPiece = {
        type,
        player: currentPlayer,
        orientation: type.includes("ARTILLERY")
          ? currentPlayer === "RED"
            ? 0
            : 180
          : undefined,
      };
    }

    // If the square is the destination of the move, then it's considered "selected" and becomes emphasized.
    const moveDestination = getMoveDestination(move);
    if (
      originPiece &&
      moveDestination &&
      areCoordsEqual(coord, moveDestination)
    ) {
      isSelected = true;
      stagedSquare = originPiece;

      // Figure out orientation based on the hovered coordinate.
      if (
        stagedSquare &&
        move.name === "MoveAndOrient" &&
        userActionState?.hoveredCoordinate
      ) {
        stagedSquare.orientation = getOrientationBetween(
          coord,
          userActionState.hoveredCoordinate
        );
      }
    }

    // If the current move would bombard this square, let's display that.
    if (
      move.name === "MoveAndOrient" &&
      isBombardedBy(board, move.args[0], move.args[1], move.args[2], coord)
    ) {
      isBombardCandidate = true;
    }
  }

  // If user is currently dragging this unit, let's consider it mid-move.
  if (selectedCoord && userActionState?.isMouseDown) {
    isMidMove = areCoordsEqual(coord, selectedCoord);
  }

  return { isSelected, isMidMove, stagedSquare, isBombardCandidate };
}

function getAnimation(
  coord: Coordinate,
  mostRecentMove: AllowedMove | undefined
) {
  let shouldAnimateTo: AnimateTo | undefined = undefined;
  if (mostRecentMove) {
    if (
      (mostRecentMove &&
        mostRecentMove.name === "Move" &&
        areCoordsEqual(mostRecentMove.args[0], coord)) ||
      (mostRecentMove.name === "MoveAndOrient" &&
        areCoordsEqual(mostRecentMove.args[0], coord))
    ) {
      shouldAnimateTo = {
        coordinate: mostRecentMove.args[1],
      };

      if (mostRecentMove.name === "MoveAndOrient") {
        shouldAnimateTo.orientation = mostRecentMove.args[2];
      }
    }
  }

  return { shouldAnimateTo };
}

function getEngagedOrientation(
  coord: Coordinate,
  engagements: Record<string, Coordinate>
) {
  let engagedOrientation: Orientation | undefined = undefined;
  const engagedCoord = engagements[`${coord[0]},${coord[1]}`];
  if (engagedCoord) {
    engagedOrientation = getOrientationBetween(coord, engagedCoord);
  }
  return engagedOrientation;
}

function getBombardStatus(
  board: Board,
  coord: Coordinate,
  userActionState: UserActionState | null,
  bombarded: Bombarded
) {
  if (!userActionState?.chosenMoves) {
    return {
      isRedBombarded: bombarded[`${coord[0]},${coord[1]}`]?.RED ?? false,
      isBlueBombarded: bombarded[`${coord[0]},${coord[1]}`]?.BLUE ?? false,
    };
  }

  const updatedBoard = JSON.parse(JSON.stringify(board));
  const originPiece = userActionState?.selectedPiece;
  if (originPiece) {
    updatedBoard[originPiece.coordinate[0]][originPiece.coordinate[1]] = null;
  }
  const updatedBombarded = bombardedSquares(updatedBoard);
  return {
    isRedBombarded: updatedBombarded[`${coord[0]},${coord[1]}`]?.RED ?? false,
    isBlueBombarded: updatedBombarded[`${coord[0]},${coord[1]}`]?.BLUE ?? false,
  };
}

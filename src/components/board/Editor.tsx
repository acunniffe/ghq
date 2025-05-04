"use client";

import {
  Coordinate,
  defaultBoard,
  defaultReserveFleet,
  Player,
  ReserveFleet,
  Square,
  Units,
} from "@/game/engine";
import SquareComponent, { SquareState } from "./Square";
import { pieceSizes, squareSizes } from "@/game/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMeasure } from "@uidotdev/usehooks";
import { ReserveBankV2 } from "./ReserveBankV2";
import BoardContainer from "./BoardContainer";

export function Editor() {
  const { measureRef, squareSize, pieceSize } = useBoardDimensions();
  const [selectedReserve, setSelectedReserve] = useState<
    keyof ReserveFleet | undefined
  >();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const board = defaultBoard;
  const redReserve = defaultReserveFleet;
  const blueReserve = defaultReserveFleet;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleLeftClick = useCallback(
    ([rowIndex, colIndex]: Coordinate) => {
      board[rowIndex][colIndex] = {
        type: selectedReserve as keyof ReserveFleet,
        player: selectedPlayer as Player,
        orientation: 0,
      };
    },
    [board, selectedReserve, selectedPlayer]
  );

  const handleMouseOver = () => {};

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <ReserveBankV2
        player="BLUE"
        reserve={blueReserve}
        selectable={true}
        selectedKind={selectedPlayer === "BLUE" ? selectedReserve : undefined}
        selectReserve={(kind) => {
          setSelectedReserve(kind);
          setSelectedPlayer("BLUE");
        }}
        squareSize={squareSize}
      />
      <BoardContainer
        ref={measureRef}
        onRightClickDrag={() => {}}
        onLeftClickDown={handleLeftClick}
        onLeftClickUp={handleLeftClick}
        onMouseOver={handleMouseOver}
        flipped={false}
        isTutorial={false}
      >
        {board.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: "flex" }}>
            {row.map((square, colIndex) => (
              <div key={colIndex}>
                <SquareComponent
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  squareState={nullSquareState(rowIndex, colIndex, square)}
                  isFlipped={false}
                />
              </div>
            ))}
          </div>
        ))}
      </BoardContainer>
      {selectedReserve && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            width: pieceSize * 0.7,
            height: pieceSize * 0.7,
            left: mousePosition.x,
            top: mousePosition.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <img
            src={`/${Units[selectedReserve].imagePathPrefix}-${selectedPlayer}.png`}
            width={pieceSize * 0.7}
            height={pieceSize * 0.7}
            draggable="false"
            alt={Units[selectedReserve].imagePathPrefix}
          />
        </div>
      )}
      <ReserveBankV2
        player="RED"
        reserve={redReserve}
        selectable={true}
        selectedKind={selectedPlayer === "RED" ? selectedReserve : undefined}
        selectReserve={(kind) => {
          setSelectedReserve(kind);
          setSelectedPlayer("RED");
        }}
        squareSize={squareSize}
      />
    </div>
  );
}

function useBoardDimensions() {
  const [measureRef, { width, height }] = useMeasure();

  const [squareSize, pieceSize] = useMemo(() => {
    const smallestDim: number = Math.min(width || 0, height || 0);
    if (!width || !height) {
      return [squareSizes.large, pieceSizes.large];
    }

    if (smallestDim && smallestDim - squareSizes.large * 8 >= 0) {
      return [squareSizes.large, pieceSizes.large];
    } else {
      return [squareSizes.small, pieceSizes.small];
    }
  }, [width, height]);

  return { measureRef, squareSize, pieceSize };
}
function nullSquareState(
  rowIndex: number,
  colIndex: number,
  square: Square
): SquareState {
  return {
    rowIndex,
    colIndex,
    square,
    stagedSquare: null,
    isRedBombarded: false,
    isBlueBombarded: false,
    isSelected: false,
    isCaptureCandidate: false,
    isBombardCandidate: false,
    showTarget: false,
    wasRecentlyCapturedPiece: undefined,
    wasRecentlyMovedTo: false,
    isMovable: false,
    isRightClicked: false,
    isHovered: false,
    isMidMove: false,
    shouldAnimateTo: undefined,
    engagedOrientation: undefined,
  };
}

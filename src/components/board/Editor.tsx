"use client";

import {
  defaultBoard,
  defaultReserveFleet,
  ReserveFleet,
  Square,
} from "@/game/engine";
import { cn } from "@/lib/utils";
import SquareComponent, { SquareState } from "./Square";
import { pieceSizes, squareSizes } from "@/game/constants";
import { useEffect, useMemo, useState } from "react";
import { useMeasure } from "@uidotdev/usehooks";
import { ReserveBankV2 } from "./ReserveBankV2";

export function Editor() {
  const { measureRef, squareSize, pieceSize } = useBoardDimensions();
  const [blueSelectedReserve, setBlueSelectedReserve] = useState<
    keyof ReserveFleet | undefined
  >();
  const [redSelectedReserve, setRedSelectedReserve] = useState<
    keyof ReserveFleet | undefined
  >();

  const board = defaultBoard;
  const redReserve = defaultReserveFleet;
  const blueReserve = defaultReserveFleet;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <ReserveBankV2
        player="BLUE"
        reserve={blueReserve}
        selectable={true}
        selectedKind={blueSelectedReserve}
        selectReserve={setBlueSelectedReserve}
        squareSize={squareSize}
      />
      <div
        ref={measureRef}
        className={cn(
          "flex flex-col w-[360px] h-[360px] lg:w-[600px] lg:h-[600px] overflow-x-hidden overflow-y-auto m-auto"
        )}
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
      </div>

      <ReserveBankV2
        player="RED"
        reserve={redReserve}
        selectable={true}
        selectedKind={redSelectedReserve}
        selectReserve={setRedSelectedReserve}
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

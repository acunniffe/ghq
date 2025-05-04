"use client";

import { cn } from "@/lib/utils";
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
import ReserveBankButton from "./ReserveBankButton";

export function Editor() {
  const { measureRef, squareSize, pieceSize } = useBoardDimensions();
  const [selectedReserve, setSelectedReserve] = useState<
    keyof ReserveFleet | undefined
  >();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedAction, setSelectedAction] = useState<
    "MOVE" | "TRASH" | "PLACE"
  >("MOVE");
  const [selectedFrom, setSelectedFrom] = useState<Coordinate | null>(null);

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
    ([rowIndex, colIndex]: Coordinate, isMouseDown: boolean) => {
      if (selectedAction === "PLACE") {
        board[rowIndex][colIndex] = {
          type: selectedReserve as keyof ReserveFleet,
          player: selectedPlayer as Player,
          orientation: selectedPlayer === "RED" ? 0 : 180,
        };
      } else if (selectedAction === "TRASH") {
        board[rowIndex][colIndex] = null;
      } else if (selectedAction === "MOVE") {
        if (isMouseDown) {
          setSelectedFrom([rowIndex, colIndex]);
        } else if (selectedFrom) {
          const square = board[selectedFrom[0]][selectedFrom[1]];
          if (square) {
            board[selectedFrom[0]][selectedFrom[1]] = null;
            board[rowIndex][colIndex] = square;
          }
        }
      }
    },
    [board, selectedReserve, selectedPlayer, selectedAction, selectedFrom]
  );

  const handleMouseOver = () => {};

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="flex items-center justify-center gap-1">
        <ReserveBankButton
          squareSize={squareSize}
          selected={selectedAction === "MOVE"}
          value="MOVE"
          imageUrl={`pointer.svg`}
          selectable={true}
          onSelect={() => {
            setSelectedReserve(undefined);
            setSelectedAction("MOVE");
          }}
        />
        <ReserveBankV2
          player="BLUE"
          reserve={blueReserve}
          selectable={true}
          selectedKind={selectedPlayer === "BLUE" ? selectedReserve : undefined}
          selectReserve={(kind) => {
            setSelectedReserve(kind);
            setSelectedPlayer("BLUE");
            setSelectedAction("PLACE");
          }}
          squareSize={squareSize}
        />
        <ReserveBankButton
          squareSize={squareSize}
          selected={selectedAction === "TRASH"}
          value="TRASH"
          imageUrl={`trash-2.svg`}
          selectable={true}
          onSelect={() => {
            setSelectedReserve(undefined);
            setSelectedAction("TRASH");
          }}
        />
      </div>
      <BoardContainer
        ref={measureRef}
        onRightClickDrag={() => {}}
        onLeftClickDown={(coord) => handleLeftClick(coord, true)}
        onLeftClickUp={(coord) => handleLeftClick(coord, false)}
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
      {(selectedAction === "PLACE" || selectedAction === "TRASH") && (
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
          {selectedAction === "PLACE" && selectedReserve && (
            <img
              className={cn(selectedPlayer === "BLUE" && "rotate-180")}
              src={`/${Units[selectedReserve].imagePathPrefix}-${selectedPlayer}.png`}
              width={pieceSize * 0.7}
              height={pieceSize * 0.7}
              draggable="false"
              alt={Units[selectedReserve].imagePathPrefix}
            />
          )}
          {selectedAction === "TRASH" && (
            <img
              className="bg-white/80 rounded-lg p-0.5"
              src={`trash-2.svg`}
              width={pieceSize * 0.7}
              height={pieceSize * 0.7}
              draggable="false"
              alt="trash"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-1">
        <ReserveBankButton
          squareSize={squareSize}
          selected={selectedAction === "MOVE"}
          value="MOVE"
          imageUrl={`pointer.svg`}
          selectable={true}
          onSelect={() => {
            setSelectedReserve(undefined);
            setSelectedAction("MOVE");
          }}
        />
        <ReserveBankV2
          player="RED"
          reserve={redReserve}
          selectable={true}
          selectedKind={selectedPlayer === "RED" ? selectedReserve : undefined}
          selectReserve={(kind) => {
            setSelectedReserve(kind);
            setSelectedPlayer("RED");
            setSelectedAction("PLACE");
          }}
          squareSize={squareSize}
        />
        <ReserveBankButton
          squareSize={squareSize}
          selected={selectedAction === "TRASH"}
          value="TRASH"
          imageUrl={`trash-2.svg`}
          selectable={true}
          onSelect={() => {
            setSelectedReserve(undefined);
            setSelectedAction("TRASH");
          }}
        />
      </div>
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

"use client";

import { cn } from "@/lib/utils";
import {
  Board,
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
import { Label } from "@radix-ui/react-label";
import { Input } from "../ui/input";
import { boardToFEN } from "@/game/notation";
import Header from "../Header";
import { Button } from "../ui/button";
import EditReservesDialog from "./EditReservesDialog";

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
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [fen, setFen] = useState<string>("");
  const [analysisUrl, setAnalysisUrl] = useState<string>("");
  const [board, setBoard] = useState<Board>(defaultBoard);
  const [redReserve, setRedReserve] =
    useState<ReserveFleet>(defaultReserveFleet);
  const [blueReserve, setBlueReserve] =
    useState<ReserveFleet>(defaultReserveFleet);

  useEffect(() => {
    let animationFrameId: number;
    const handleMouseMove = (e: MouseEvent) => {
      animationFrameId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleLeftClick = useCallback(
    ([rowIndex, colIndex]: Coordinate, isMouseDown: boolean) => {
      const newBoard = structuredClone(board);

      if (selectedAction === "PLACE") {
        newBoard[rowIndex][colIndex] = {
          type: selectedReserve as keyof ReserveFleet,
          player: selectedPlayer as Player,
          orientation: selectedPlayer === "RED" ? 0 : 180,
        };
      } else if (selectedAction === "TRASH") {
        newBoard[rowIndex][colIndex] = null;
      } else if (selectedAction === "MOVE") {
        if (isMouseDown) {
          setSelectedFrom([rowIndex, colIndex]);
          setSelectedSquare(newBoard[rowIndex][colIndex]);
        } else if (selectedFrom && selectedSquare) {
          newBoard[selectedFrom[0]][selectedFrom[1]] = null;
          newBoard[rowIndex][colIndex] = selectedSquare;
          setSelectedFrom(null);
          setSelectedSquare(null);
        }
      }

      setBoard(newBoard);
    },
    [
      board,
      selectedReserve,
      selectedPlayer,
      selectedAction,
      selectedFrom,
      selectedSquare,
    ]
  );

  useEffect(() => {
    setFen(boardToFEN({ board, redReserve, blueReserve }));
    const url = new URL(window.location.toString());
    url.pathname = "/learn";
    url.searchParams.set(
      "jfen",
      boardToFEN({ board, redReserve, blueReserve })
    );
    setAnalysisUrl(url.toString());
  }, [board, redReserve, blueReserve]);

  const handleMouseOver = () => {};

  return (
    <div className="flex flex-col items-center gap-2 px-2 lg:px-48 mb-20">
      <div className="w-full">
        <Header />
      </div>

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
                  squareState={simpleSquareState(
                    rowIndex,
                    colIndex,
                    square,
                    selectedFrom
                  )}
                  isFlipped={false}
                />
              </div>
            ))}
          </div>
        ))}
      </BoardContainer>

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
        {selectedAction === "MOVE" && selectedSquare && (
          <img
            className={cn(selectedSquare.player === "BLUE" && "rotate-180")}
            src={`/${
              Units[selectedSquare.type].imagePathPrefix
            }-${selectedSquare.player.toLowerCase()}.png`}
            width={pieceSize * 0.7}
            height={pieceSize * 0.7}
            draggable="false"
            alt={Units[selectedSquare.type].imagePathPrefix}
          />
        )}
        {selectedAction === "PLACE" && selectedReserve && (
          <img
            className={cn(selectedPlayer === "BLUE" && "rotate-180")}
            src={`/${
              Units[selectedReserve].imagePathPrefix
            }-${selectedPlayer?.toLowerCase()}.png`}
            width={pieceSize * 0.7}
            height={pieceSize * 0.7}
            draggable="false"
            alt={Units[selectedReserve].imagePathPrefix}
          />
        )}
        {selectedAction === "TRASH" && (
          <img
            className="bg-white/50 rounded-lg"
            src={`trash-2.svg`}
            width={pieceSize * 0.7}
            height={pieceSize * 0.7}
            draggable="false"
            alt="trash"
          />
        )}
      </div>

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

      <div className="flex gap-2 mt-2 w-[360px] lg:w-[600px]">
        <Button variant="outline" onClick={() => setBoard(defaultBoard)}>
          Reset to default
        </Button>
        <EditReservesDialog
          redReserve={redReserve}
          blueReserve={blueReserve}
          onSave={(newRedReserve, newBlueReserve) => {
            setRedReserve(newRedReserve);
            setBlueReserve(newBlueReserve);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 mt-2 w-[360px] lg:w-[600px]">
        <div className="flex items-center gap-2 w-full">
          <Label htmlFor="jfen">FEN</Label>
          <Input
            readOnly
            spellCheck={false}
            className="font-mono flex-1"
            type="fen"
            id="fen"
            placeholder=""
            value={fen}
          />
        </div>
        <div className="flex items-center gap-2 w-full">
          <Label htmlFor="jfen">URL</Label>
          <Input
            readOnly
            spellCheck={false}
            className="font-mono flex-1"
            type="url"
            id="analysis"
            placeholder=""
            value={analysisUrl}
          />
        </div>
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

function simpleSquareState(
  rowIndex: number,
  colIndex: number,
  square: Square,
  selectedFrom: Coordinate | null
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
    isMidMove:
      (selectedFrom &&
        selectedFrom[0] === rowIndex &&
        selectedFrom[1] === colIndex) ||
      false,
    shouldAnimateTo: undefined,
    engagedOrientation: undefined,
  };
}

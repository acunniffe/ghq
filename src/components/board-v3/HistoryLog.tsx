import { ReactNode, useCallback, useEffect, useMemo } from "react";
import { GameClient, Turn } from "@/game/engine-v2";
import {
  AllowedMove,
  Orientation,
  Player,
  Units,
  UnitType,
} from "@/game/engine";
import { coordinateToAlgebraic, degreesToCardinal } from "@/game/notation";
import {
  ArrowBigRightDash,
  Bomb,
  Crosshair,
  RotateCw,
  Ship,
  SkipForward,
} from "lucide-react";
import { SeekFunc } from "./useSeek";
import { cn } from "@/lib/utils";

export function HistoryLog({
  game,
  seek,
  seekIndex,
}: {
  game: GameClient;
  seek: SeekFunc;
  seekIndex: number;
}) {
  const gameover = game.gameover();

  useEffect(() => {
    const messagesDiv = document.querySelector("#history-log-list");
    if (messagesDiv) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }, [game.moves.length]);

  const onMoveClick = useCallback(
    (index: number) => {
      seek({ index });
    },
    [seek]
  );

  const elapsedSecsToString = (elapsedSecs: number) => {
    if (elapsedSecs < 60) {
      return elapsedSecs.toFixed(1) + "s";
    }

    const minutes = Math.floor(elapsedSecs / 60);
    const seconds = elapsedSecs % 60;
    if (seconds === 0) {
      return minutes + "m";
    }
    return minutes + "m " + seconds.toFixed(0) + "s";
  };

  interface DetailedMove {
    turn: Turn;
    turnIndex: number;
    move: AllowedMove;
    moveIndex: number;
  }

  const detailedMoves: DetailedMove[] = game.turns.flatMap(
    (turn, turnIndex) => {
      return turn.moves.map((move, moveIndex): DetailedMove => {
        return {
          turn,
          turnIndex,
          move,
          moveIndex,
        };
      });
    }
  );

  const maxDuration = useMemo(() => {
    return Math.max(...detailedMoves.map(({ turn }) => turn.elapsedSecs));
  }, [detailedMoves]);

  return (
    <div className="flex flex-col gap-1 p-2 h-[350px]">
      <div className="font-bold text-gray-800">Activity</div>
      <div
        id="history-log-list"
        className="overflow-y-auto border h-[600px] flex flex-col rounded bg-gray-50"
      >
        {detailedMoves.map(
          ({ turn, turnIndex, move, moveIndex }, overallMoveIndex) => {
            const readable = moveToReadableString(move);
            const player = turnIndex % 2 === 0 ? "RED" : "BLUE";

            return (
              <div
                key={overallMoveIndex}
                className={cn(
                  "inline-flex justify-between items-center hover:bg-gray-200 px-2 py-0.5 text-xs text-gray-800",
                  overallMoveIndex === seekIndex - 1 && "bg-gray-200",
                  moveIndex === turn.moves.length - 1 && turn.elapsedSecs > 0
                    ? "border-b border-gray-200"
                    : ""
                )}
                title={readable}
                onClick={() => onMoveClick(overallMoveIndex + 1)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-gray-600 text-xxs">
                    {turnIndex + 1}
                  </span>
                  <div className="inline-flex items-center space-x-1">
                    {renderMove(game, move, player)}
                  </div>
                </div>

                {moveIndex === turn.moves.length - 1 &&
                  turn.elapsedSecs > 0 && (
                    <div className="flex items-center space-x-1">
                      <DurationIndicator
                        maxDuration={maxDuration}
                        duration={turn.elapsedSecs}
                        player={player}
                      />
                      <div className="text-gray-800/70 text-xxs font-semibold">
                        {elapsedSecsToString(turn.elapsedSecs)}
                      </div>
                    </div>
                  )}
              </div>
            );
          }
        )}

        {gameover && (
          <div className="inline-flex space-x-2 items-center py-0.5 px-1 font-semibold text-sm text-gray-800">
            {gameover.status === "DRAW" && "Game ended in a draw"}
            {gameover.winner && (
              <>
                {gameover.winner.charAt(0).toUpperCase() +
                  gameover.winner.slice(1).toLowerCase()}{" "}
                won {gameover.reason}!
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function moveToReadableString(move: AllowedMove): string {
  if (move.name === "Skip") {
    return "Skipped rest of turn";
  }

  if (move.name === "Reinforce") {
    const [unitType, at, capturePreference] = move.args;
    const unitName = unitType?.toLowerCase().replace(/_/g, " ") || "piece";
    const atNotation = coordinateToAlgebraic(at);
    let description = `Reinforced with ${unitName} at ${atNotation}`;

    if (capturePreference) {
      const captureNotation = coordinateToAlgebraic(capturePreference);
      description += ` and captured piece on ${captureNotation}`;
    }

    return description;
  }

  if (move.name === "Move") {
    const [from, to, capturePreference] = move.args;
    const fromNotation = coordinateToAlgebraic(from);
    const toNotation = coordinateToAlgebraic(to);
    let description = `Moved piece from ${fromNotation} to ${toNotation}`;

    if (capturePreference) {
      const captureNotation = coordinateToAlgebraic(capturePreference);
      description += ` and captured piece on ${captureNotation}`;
    }

    return description;
  }

  if (move.name === "MoveAndOrient") {
    const [from, to, orientation] = move.args;
    const fromNotation = coordinateToAlgebraic(from);
    const toNotation = coordinateToAlgebraic(to);
    const direction = degreesToCardinal(orientation as Orientation);
    return `Moved piece from ${fromNotation} to ${toNotation} and rotated ${direction}`;
  }

  if (move.name === "AutoCapture") {
    const [autoCaptureType, capturePreference] = move.args;
    if (autoCaptureType === "bombard") {
      const captureNotation = coordinateToAlgebraic(capturePreference!);
      return `Artillery bombarded piece at ${captureNotation}`;
    } else if (autoCaptureType === "free") {
      const captureNotation = coordinateToAlgebraic(capturePreference!);
      return `Captured piece at ${captureNotation}`;
    }
  }

  return move.name;
}

function renderMove(
  game: GameClient,
  move: AllowedMove,
  player: Player
): ReactNode {
  if (move.name === "Skip") {
    return (
      <>
        <SkipForward className="w-3 h-3" />
        <span>skip</span>
      </>
    );
  }

  if (move.name === "Reinforce") {
    const [unitType, at, capturePreference] = move.args;
    return (
      <>
        <PieceIcon player={player} unitType={unitType!} />
        <Ship className="w-3 h-3" />
        <span>{coordinateToAlgebraic(at)}</span>
        {capturePreference && (
          <>
            <Crosshair className="w-3 h-3" />
            <span>{coordinateToAlgebraic(capturePreference)}</span>
          </>
        )}
      </>
    );
  }

  if (move.name === "Move") {
    const [from, to, capturePreference] = move.args;
    return (
      <>
        <span>{coordinateToAlgebraic(from)}</span>
        <ArrowBigRightDash className="w-3 h-3" />
        <span>{coordinateToAlgebraic(to)}</span>
        {capturePreference && (
          <>
            <Crosshair className="w-3 h-3" />
            <span>{coordinateToAlgebraic(capturePreference)}</span>
          </>
        )}
      </>
    );
  }

  if (move.name === "MoveAndOrient") {
    const [from, to, orientation] = move.args;
    return (
      <>
        <span>{coordinateToAlgebraic(from)}</span>
        <ArrowBigRightDash className="w-3 h-3" />
        <span>{coordinateToAlgebraic(to)}</span>
        <RotateCw className="w-3 h-3" />
        <span>{degreesToCardinal(orientation as Orientation)}</span>
      </>
    );
  }

  if (move.name === "AutoCapture") {
    const [autoCaptureType, capturePreference] = move.args;
    if (autoCaptureType === "bombard") {
      return (
        <>
          <Bomb className="w-3 h-3" />
          <span>{coordinateToAlgebraic(capturePreference!)}</span>
        </>
      );
    } else if (autoCaptureType === "free") {
      return (
        <>
          <Crosshair className="w-3 h-3" />
          <span>{coordinateToAlgebraic(capturePreference!)}</span>
        </>
      );
    }
  }

  return <span>{move.name}</span>;
}

function PieceIcon({
  player,
  unitType,
}: {
  player: Player;
  unitType: UnitType;
}) {
  return (
    <img
      className="inline-block"
      src={`/${Units[unitType].imagePathPrefix}-${player.toLowerCase()}.png`}
      width={10}
      height={10}
      draggable="false"
      alt={Units[unitType].imagePathPrefix}
    />
  );
}

function DurationIndicator({
  maxDuration,
  duration,
  player,
}: {
  maxDuration: number;
  duration: number;
  player: Player;
}) {
  const width = useMemo(() => {
    if (duration === 0) {
      return 2;
    }
    const percent = duration / maxDuration;
    const baseWidthPx = 60;
    const minWidthPx = 2;
    return Math.max(minWidthPx, baseWidthPx * percent);
  }, [duration, maxDuration]);
  return (
    <div
      style={{ width: `${width}px` }}
      className={cn(
        "rounded h-2",
        player === "RED" ? "bg-red-500/50" : "bg-blue-500/50"
      )}
    ></div>
  );
}

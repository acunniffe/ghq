import { ReactNode, useCallback, useEffect } from "react";
import { GameClient } from "@/game/engine-v2";
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

export function HistoryLog({
  game,
  seek,
}: {
  game: GameClient;
  seek: SeekFunc;
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

  return (
    <div className="flex flex-col gap-1 p-2 h-[350px]">
      <div className="font-bold text-gray-800">Activity</div>
      <div
        id="history-log-list"
        className="overflow-y-auto border h-[600px] flex flex-col rounded"
      >
        {game.moves.map((move, index) => {
          const readable = moveToReadableString(move);
          const turnNumber = Math.floor(index / 3) + 1;
          const player = index % 6 < 3 ? "RED" : "BLUE";

          return (
            <div
              key={index}
              className="inline-flex space-x-3 items-center hover:bg-gray-100 py-0.5 px-2 text-sm"
              title={readable}
              onClick={() => onMoveClick(index + 1)}
            >
              <span className="text-gray-600 text-xs">{turnNumber}</span>
              <div className="inline-flex items-center space-x-1">
                {renderMove(game, move, player)}
              </div>
            </div>
          );
        })}

        {gameover && (
          <div className="inline-flex space-x-2 items-center py-0.5 px-1 font-semibold">
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
    return "skipped rest of turn";
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
      width={12}
      height={12}
      draggable="false"
      alt={Units[unitType].imagePathPrefix}
    />
  );
}

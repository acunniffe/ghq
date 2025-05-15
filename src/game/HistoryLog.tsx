import React, { ReactNode } from "react";
import {
  Coordinate,
  GameoverState,
  GHQState,
  HistoryItem,
  Orientation,
  Player,
  Square,
  Units,
  UnitType,
} from "@/game/engine";
import { BoardProps } from "boardgame.io/react";
import { coordinateToAlgebraic, degreesToCardinal } from "./notation";
import { LogEntry } from "boardgame.io";
import {
  ArrowBigRightDash,
  Bomb,
  Crosshair,
  Flag,
  RotateCw,
  Ship,
  SkipForward,
  User,
} from "lucide-react";

export function HistoryLog({
  systemMessages,
  log,
  gameover,
}: {
  systemMessages?: HistoryItem[];
  log: BoardProps<GHQState>["log"];
  gameover?: GameoverState;
}) {
  // TODO(tyler): show history from log uci
  const filteredLog: LogEntry[] = [];

  const undoneMoves: LogEntry[] = [];
  for (const entry of log) {
    if (entry.action.type === "UNDO") {
      const lastMove = filteredLog.pop();
      lastMove && undoneMoves.push(lastMove);
    } else if (entry.action.type === "REDO") {
      const lastUndoneMove = undoneMoves.pop();
      lastUndoneMove && filteredLog.push(lastUndoneMove);
    } else {
      filteredLog.push(entry);
    }
  }

  const playerMessages = filteredLog
    .filter((entry) => entry.action.type === "MAKE_MOVE")
    .map((entry) => {
      const { playerID, type, args } = entry.action.payload;
      const player = playerID === "0" ? "RED" : "BLUE";
      let description = type;
      let reactNode: ReactNode | null = null;
      const pieceType = entry?.metadata?.pieceType?.toLowerCase() ?? "piece";

      if (type === "Move") {
        const [from, to] = args;
        const fromNotation = coordinateToAlgebraic(from);
        const toNotation = coordinateToAlgebraic(to);
        description = `moved ${pieceType} from ${fromNotation} to ${toNotation}`;

        const capture = entry?.metadata?.capturePreference;
        if (capture) {
          const captureType = entry?.metadata?.capturedPiece?.type ?? "piece";
          const captureNotation = coordinateToAlgebraic(capture);
          description += ` and captured ${captureType.toLowerCase()} on ${captureNotation}`;
        }

        reactNode = movedPiece({
          player,
          unitType: entry?.metadata?.pieceType,
          from,
          to,
          capturedPiece: entry?.metadata?.capturedPiece,
          capturedCoordinate: entry?.metadata?.capturePreference,
          description,
        });
      } else if (type === "Reinforce") {
        const [kind, at] = args;
        const atNotation = coordinateToAlgebraic(at);
        description = `reinforced with ${kind.toLowerCase()} at ${atNotation}`;
        reactNode = reinforcedPiece({
          player,
          unitType: kind,
          at,
          description,
        });
      } else if (type === "MoveAndOrient") {
        const [from, to, orientation] = args;
        const fromNotation = coordinateToAlgebraic(from);
        const toNotation = coordinateToAlgebraic(to);
        description = `moved ${pieceType} from ${fromNotation} to ${toNotation} and rotated ${degreesToCardinal(
          orientation
        )}`;
        reactNode = movedPiece({
          player,
          unitType: entry?.metadata?.pieceType,
          from,
          to,
          orientation,
          description,
        });
      } else if (type === "ChangeOrientation") {
        const [at, orientation] = args;
        const atNotation = coordinateToAlgebraic(at);
        description = `rotated ${pieceType} at ${atNotation} ${degreesToCardinal(
          orientation
        )}`;
      } else if (type === "Skip") {
        description = "skipped rest of turn";
        reactNode = playerSkip({ player, description });
      } else if (type === "Resign") {
        description = "resigned";
        reactNode = playerResign({ player, description });
      } else if (type === "AutoCapture") {
        const [bombardOrFree, capturePreference] = args;
        description = `${bombardOrFree.toLowerCase()} ${capturePreference.toLowerCase()}`;
        reactNode = playerAction({
          player,
          action: type,
          description: `${player} ${type}`,
        });
      } else {
        reactNode = playerAction({
          player,
          action: type,
          description: `${player} ${type}`,
        });
      }
      return {
        turn: entry.turn,
        message: `${player} ${description}`,
        reactNode,
      };
    });

  const systemCaptureMessages =
    systemMessages?.flatMap(
      ({ turn, playerId, captured, message, capturedByInfantry }) => {
        if (message) {
          return { turn, message, reactNode: null };
        }

        if (captured) {
          const player = playerId === "0" ? "RED" : "BLUE";
          const clearedSquares = captured.map(({ coordinate }) => coordinate);

          if (capturedByInfantry) {
            return capturedByInfantry.map((infantry, i) => {
              const attackerPieceType =
                typeof infantry.piece.type === "string"
                  ? infantry.piece.type.toLowerCase()
                  : "piece";
              const capturedPieceType =
                typeof captured[i]?.square?.type === "string"
                  ? captured[i]?.square?.type?.toLowerCase()
                  : "piece";
              return {
                turn,
                message: `${player} ${attackerPieceType} captured ${capturedPieceType} at ${coordinateToAlgebraic(
                  clearedSquares[i]
                )} at start of turn`,
                reactNode: startOfTurnCapture({
                  player,
                  capturedPiece: captured[i].square,
                  capturedCoordinate: clearedSquares[i],
                  description: `${player} ${attackerPieceType} captured ${capturedPieceType} at ${coordinateToAlgebraic(
                    clearedSquares[i]
                  )} at start of turn`,
                }),
              };
            });
          } else {
            return clearedSquares.map((coord) => {
              return {
                turn,
                message: `${player} artillery bombarded piece at ${coordinateToAlgebraic(
                  coord
                )} at start of turn`,
                reactNode: startOfTurnCapture({
                  player,
                  capturedCoordinate: coord,
                  isBombardment: true,
                  description: `${player} artillery bombarded piece at ${coordinateToAlgebraic(
                    coord
                  )} at start of turn`,
                }),
              };
            });
          }
        }

        return { turn, message: "", reactNode: null };
      }
    ) ?? [];

  const combinedMessages = [...systemCaptureMessages, ...playerMessages].sort(
    (a, b) => a.turn - b.turn
  );

  // TODO(tyler): figure out why duplicate messages are coming through
  const deduplicatedMessages = combinedMessages.filter(
    (msg, index, self) =>
      index === self.findIndex((m) => m.message === msg.message)
  );

  React.useEffect(() => {
    const messagesDiv = document.querySelector("#history-log-list");
    if (messagesDiv) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }, [playerMessages]);

  function handleClick(turn: number) {
    const event = new CustomEvent("historyLogTurnClick", { detail: { turn } });
    window.dispatchEvent(event);
  }

  return (
    <div className="flex flex-col gap-1 p-2 h-[350px]">
      <div className="font-bold text-lg">Activity</div>
      <div
        id="history-log-list"
        className="overflow-y-auto border h-[600px] flex flex-col rounded"
      >
        {deduplicatedMessages.map((msg) => (
          <div
            key={msg.message}
            className="inline-flex space-x-2 items-center hover:bg-gray-100 py-0.5 px-1"
            onClick={() => handleClick(msg.turn)}
          >
            <span className="text-gray-600 text-xs">{msg.turn} </span>
            {msg.reactNode ? msg.reactNode : <div>{msg.message}</div>}
          </div>
        ))}

        {gameover && (
          <div className="inline-flex space-x-2 items-center">
            {gameover.status === "DRAW" && "Game ended in a draw"}
            {gameover.winner && (
              <>
                {toTitleCase(gameover.winner)} won {gameover.reason}!
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function movedPiece({
  player,
  unitType,
  from,
  to,
  capturedPiece,
  capturedCoordinate,
  orientation,
  description,
}: {
  player: Player;
  unitType: UnitType;
  from: Coordinate;
  to: Coordinate;
  capturedPiece?: Square;
  capturedCoordinate?: Coordinate;
  orientation?: Orientation;
  description: string;
}): ReactNode {
  return (
    <div
      className="inline-flex items-center space-x-2 text-sm"
      title={description}
    >
      <PieceIcon player={player} unitType={unitType} />
      <div className="align-text-bottom">{coordinateToAlgebraic(from)}</div>
      <ArrowBigRightDash className="w-3 h-3 inline-block" />
      <div className="align-text-bottom">{coordinateToAlgebraic(to)}</div>
      {capturedPiece && capturedCoordinate && (
        <div className="inline-flex items-center space-x-2">
          <Crosshair className="w-3 h-3" />
          <PieceIcon
            player={capturedPiece.player}
            unitType={capturedPiece.type}
          />
          <div className="align-text-bottom">
            {coordinateToAlgebraic(capturedCoordinate)}
          </div>
        </div>
      )}
      {orientation !== undefined && (
        <div className="inline-flex items-center space-x-2">
          <RotateCw className="w-3 h-3" />
          <div className="align-text-bottom">
            {degreesToCardinal(orientation)}
          </div>
        </div>
      )}
    </div>
  );
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

function reinforcedPiece({
  player,
  unitType,
  at,
  description,
}: {
  player: Player;
  unitType: UnitType;
  at: Coordinate;
  description: string;
}): ReactNode {
  return (
    <div
      className="inline-flex items-center space-x-2 text-sm"
      title={description}
    >
      <PieceIcon player={player} unitType={unitType} />
      <Ship className="w-3 h-3 inline-block" />
      <div className="align-text-bottom">{coordinateToAlgebraic(at)}</div>
    </div>
  );
}

function playerSkip({
  player,
  description,
}: {
  player: Player;
  description: string;
}): ReactNode {
  return (
    <div
      className="inline-flex items-center space-x-2 text-sm"
      title={description}
    >
      <PlayerIcon player={player} />
      <SkipForward className="w-3 h-3 inline-block" />
    </div>
  );
}

function PlayerIcon({ player }: { player: Player }): ReactNode {
  return (
    <User
      className="w-4 h-4 inline-block"
      style={{
        color: player === "RED" ? "var(--red)" : "var(--blue)",
        fill: player === "RED" ? "var(--red)" : "var(--blue)",
      }}
    />
  );
}

function startOfTurnCapture({
  player,
  capturedPiece,
  capturedCoordinate,
  isBombardment,
  description,
}: {
  player: Player;
  capturedPiece?: Square;
  capturedCoordinate?: Coordinate;
  isBombardment?: boolean;
  description: string;
}): ReactNode {
  return (
    <div
      className="inline-flex items-center space-x-2 text-sm"
      title={description}
    >
      <PlayerIcon player={player} />
      {isBombardment ? (
        <Bomb className="w-3 h-3" />
      ) : (
        <Crosshair className="w-3 h-3" />
      )}
      {capturedPiece ? (
        <PieceIcon
          player={capturedPiece.player}
          unitType={capturedPiece.type}
        />
      ) : (
        <PlayerIcon player={player === "RED" ? "BLUE" : "RED"} />
      )}
      {capturedCoordinate && (
        <div className="align-text-bottom">
          {coordinateToAlgebraic(capturedCoordinate)}
        </div>
      )}
    </div>
  );
}

function playerResign({
  player,
  description,
}: {
  player: Player;
  description: string;
}): ReactNode {
  return (
    <div
      className="inline-flex items-center space-x-2 text-sm"
      title={description}
    >
      <PlayerIcon player={player} />
      <Flag className="w-3 h-3 inline-block" />
    </div>
  );
}

function playerAction({
  player,
  action,
  description,
}: {
  player: Player;
  action: string;
  description: string;
}): ReactNode {
  return (
    <div
      className="inline-flex items-center space-x-2 text-sm"
      title={description}
    >
      <PlayerIcon player={player} />
      <div className="align-text-bottom">{action}</div>
    </div>
  );
}

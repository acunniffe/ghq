"use client";

import { Player, ReserveFleet } from "@/game/engine";
import CountdownTimer from "@/game/countdown";

import MoveCounter from "../../game/MoveCounter";
import { ChatMessage } from "boardgame.io";
import { UserActionState } from "./state";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import classNames from "classnames";
import ChatIcon from "./ChatIcon";
import LatestChatMessage from "./LatestChatMessage";
import { User } from "@/lib/types";
import Username from "@/components/Username";
import { GameClient } from "@/game/engine-v2";
import { ReserveBankV2 } from "./ReserveBankV2";
import { cn } from "@/lib/utils";

export default function Reserve({
  game,
  player,
  currentPlayer,
  currentPlayerTurn,
  userActionState,
  users,
  selectReserve,
  sendChatMessage,
  chatMessages,
  squareSize,
}: {
  game: GameClient;
  player: Player;
  currentPlayer: Player;
  currentPlayerTurn: Player;
  sendChatMessage: (message: string) => void;
  chatMessages: ChatMessage[];
  userActionState: UserActionState;
  users: User[];
  selectReserve: (kind: keyof ReserveFleet) => void;
  squareSize: number;
}) {
  const playerIndex = player === "RED" ? 0 : 1;
  const defaultUsername = `Player ${playerIndex + 1}`;
  const userId = game.userIds?.[playerIndex];
  const user = users.find((user) => user.id === userId);

  if (game.isTutorial) {
    return (
      <div className="items-center justify-center flex py-2 px-1 gap-2">
        <ReserveBankV2
          player={player}
          reserve={game.reserves(player)}
          selectable={player === currentPlayerTurn && player === currentPlayer}
          selectedKind={
            player === currentPlayerTurn
              ? userActionState.selectedReserve
              : undefined
          }
          selectReserve={selectReserve}
          squareSize={squareSize}
          hideHQ={true}
        />
      </div>
    );
  }

  return (
    <>
      <LatestChatMessage player={player} chatMessages={chatMessages} />
      <div
        className={cn(
          "items-center justify-center flex flex-col w-full px-1 gap-1",
          player === "RED" && "flex-col-reverse"
        )}
      >
        <div className="flex justify-between gap-1 w-full">
          <div className="flex gap-2 items-center flex-1">
            {/* {matchData?.[playerIndex]?.isConnected !== undefined && (
              <ConnectionStatus
                isConnected={matchData[playerIndex].isConnected}
              />
            )} */}
            {user ? (
              <Username user={user} includeElo />
            ) : (
              <div>{defaultUsername}</div>
            )}
          </div>
          <div className="flex gap-2 justify-center items-center">
            <MoveCounter
              numMoves={game.numMovesThisTurn()}
              active={currentPlayerTurn === player && !game.gameover()}
            />
            <CountdownTimer
              active={
                currentPlayerTurn === player &&
                !game.gameover() &&
                !game.isReplayMode
              }
              player={player}
              elapsed={game.elapsedMs[player]}
              startDate={game.startTimeMs}
              totalTimeAllowed={game.totalTimeAllowed}
              isReplayMode={game.isReplayMode ?? false}
            />
          </div>
        </div>
        <div className="flex gap-3 md:gap-5 items-center">
          <ReserveBankV2
            player={player}
            reserve={game.reserves(player)}
            selectable={
              player === currentPlayerTurn &&
              player === currentPlayer &&
              !game.hasMoveLimitReached()
            }
            selectedKind={
              player === currentPlayerTurn
                ? userActionState.selectedReserve
                : undefined
            }
            selectReserve={selectReserve}
            squareSize={squareSize}
            hideHQ={true}
          />
          {player === currentPlayer && (
            <ChatIcon sendChatMessage={sendChatMessage} />
          )}
        </div>
      </div>
    </>
  );
}

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        className={classNames(
          "w-3 h-3 rounded-full",
          isConnected ? "bg-green-600" : "bg-red-600"
        )}
      ></HoverCardTrigger>
      <HoverCardContent className="text-sm">
        Player is currently {isConnected ? "connected" : "disconnected"}.
      </HoverCardContent>
    </HoverCard>
  );
}

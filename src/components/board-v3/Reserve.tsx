"use client";

import { Player, ReserveFleet } from "@/game/engine";

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
import { MatchV3, User } from "@/lib/types";
import Username from "@/components/Username";
import { GameClient } from "@/game/engine-v2";
import { ReserveBankV2 } from "./ReserveBankV2";
import { cn } from "@/lib/utils";
import CountdownTimer from "./CountdownTimer";
import { useMemo } from "react";
import { useMatchmaking } from "../MatchmakingProvider";

export default function Reserve({
  game,
  match,
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
  match?: MatchV3;
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
  const { usersOnline } = useMatchmaking();
  const playerIndex = player === "RED" ? 0 : 1;
  const defaultUsername = `Player ${playerIndex + 1}`;
  const userId = player === "RED" ? match?.player0UserId : match?.player1UserId;
  const user = useMemo(
    () => users.find((u) => u.id === userId),
    [users, userId]
  );

  // NB(tyler): This just shows whether the user is on the site at all, not whether they're in this particular game.
  // We should improve this in the future.
  const isConnected = useMemo(() => {
    const onlineUser = usersOnline?.users.find((u) => u.id === user?.id);
    return onlineUser?.status && onlineUser.status !== "offline";
  }, [usersOnline, user]);

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
            {game.isOnline && <ConnectionStatus isConnected={!!isConnected} />}
            {user ? (
              <Username user={user} includeElo />
            ) : (
              <div>{defaultUsername}</div>
            )}
          </div>
          <div className="flex gap-2 justify-center items-center">
            <MoveCounter
              numMoves={game.numMovesThisTurn()}
              active={currentPlayerTurn === player && !game.ended}
            />
            <CountdownTimer
              active={
                currentPlayerTurn === player &&
                !game.ended &&
                !game.isReplayMode
              }
              player={player}
              game={game}
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
          {/* {player === currentPlayer && (
            <ChatIcon sendChatMessage={sendChatMessage} />
          )} */}
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

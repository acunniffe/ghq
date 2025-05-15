"use client";

import { GHQState, Player, ReserveFleet } from "@/game/engine";
import CountdownTimer from "@/game/countdown";

import MoveCounter from "../../game/MoveCounter";
import { ChatMessage, Ctx } from "boardgame.io";
import { ReserveBank } from "../../game/board";
import { UserActionState } from "./state";
import { BoardProps } from "boardgame.io/react";
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
import { numMovesThisTurn } from "@/game/engine-v2";

export default function Reserve({
  G,
  ctx,
  matchData,
  player,
  currentPlayer,
  currentPlayerTurn,
  userActionState,
  users,
  selectReserve,
  sendChatMessage,
  chatMessages,
}: {
  G: GHQState;
  ctx: Ctx;
  matchData: BoardProps<GHQState>["matchData"];
  player: Player;
  currentPlayer: Player;
  currentPlayerTurn: Player;
  sendChatMessage: (message: string) => void;
  chatMessages: ChatMessage[];
  userActionState: UserActionState;
  users: User[];
  selectReserve: (kind: keyof ReserveFleet) => void;
}) {
  const playerIndex = player === "RED" ? 0 : 1;
  const defaultUsername = `Player ${playerIndex + 1}`;
  const userId = G.userIds?.[playerIndex];
  const user = users.find((user) => user.id === userId);

  return (
    <>
      <LatestChatMessage player={player} chatMessages={chatMessages} />
      <div className="items-center justify-center flex py-2 px-1">
        <ReserveBank
          player={player}
          reserve={player === "RED" ? G.redReserve : G.blueReserve}
          selectedKind={
            player === currentPlayerTurn
              ? userActionState.selectedReserve
              : undefined
          }
          selectable={player === currentPlayerTurn && player === currentPlayer}
          selectReserve={selectReserve}
        />
        <div className="ml-4 lg:ml-20 my-2 flex flex-col gap-1">
          {!G.isTutorial && (
            <div className="flex gap-2 items-center">
              {matchData?.[playerIndex]?.isConnected !== undefined && (
                <ConnectionStatus
                  isConnected={matchData[playerIndex].isConnected}
                />
              )}
              {user ? (
                <Username user={user} includeElo />
              ) : (
                <div>{defaultUsername}</div>
              )}
            </div>
          )}
          {!G.isTutorial && (
            <div className="flex gap-2 justify-center items-center">
              {player === currentPlayer && (
                <ChatIcon sendChatMessage={sendChatMessage} />
              )}
              <MoveCounter
                numMoves={numMovesThisTurn(G)}
                active={currentPlayerTurn === player && !ctx.gameover}
              />
              <CountdownTimer
                active={
                  currentPlayerTurn === player &&
                  !ctx.gameover &&
                  !G.isReplayMode
                }
                player={player}
                elapsed={player === "RED" ? G.redElapsed : G.blueElapsed}
                startDate={G.turnStartTime}
                totalTimeAllowed={G.timeControl}
                isReplayMode={G.isReplayMode ?? false}
              />
            </div>
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

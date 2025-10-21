"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getOpponent } from "../../game/board-moves";

import { updateReserveClick, UserActionState } from "./state";
import Reserve from "./Reserve";
import MoveProgressBar from "./MoveProgressBar";
import Board from "./Board";
import classNames from "classnames";
import ControlsView from "./ControlsView";
import useBoard from "./useBoard";
import { Settings } from "./SettingsMenu";
import { useUsers } from "./useUsers";
import { GameClient, Player } from "@/game/engine-v2";
import { pieceSizes } from "@/game/constants";
import { useMeasure } from "@uidotdev/usehooks";
import { squareSizes } from "@/game/constants";
import { SeekFunc } from "./useSeek";

interface PlayAreaProps {
  className: string;
  game: GameClient;
  seek: SeekFunc;
  settings: Settings;
}

export default function PlayArea({
  className,
  game,
  seek,
  settings,
}: PlayAreaProps) {
  const [userActionState, setUserActionState] = useState<UserActionState>({});
  const [viewPlayerPref, setViewPlayerPref] = useState<Player>("RED");
  const currentPlayerTurn = useMemo(() => game.currentPlayerTurn(), [game]);
  const { isReplayMode, isTutorial, isPassAndPlayMode, playerID } = game;
  const { measureRef, squareSize, pieceSize } = useBoardDimensions(isTutorial);

  // TODO(tyler): allow spectators to choose which side to view
  const defaultPlayerPOV = "RED";

  // Note: playerID is null in local play (non-multiplayer, non-bot), also when spectating, replaying, and tutorials.
  const currentPlayer = useMemo(() => {
    if (isReplayMode) {
      return defaultPlayerPOV;
    }
    return playerID === null ? currentPlayerTurn : playerIdToPlayer(playerID);
  }, [currentPlayerTurn, playerID, isReplayMode]);
  const { users } = useUsers({ userIds: [] }); // TODO(tyler): implement this

  const isFlipped = useMemo(() => viewPlayerPref === "BLUE", [viewPlayerPref]);

  useEffect(() => {
    // If G.isPassAndPlayMode, then viewPlayerPref should snap to currentPlayerTurn.
    if (isPassAndPlayMode && settings.autoFlipBoard && playerID === null) {
      setViewPlayerPref(currentPlayerTurn);
    } else if (playerID !== null) {
      setViewPlayerPref(playerIdToPlayer(playerID));
    }
  }, [isPassAndPlayMode, playerID, currentPlayerTurn, settings]);

  const possibleAllowedMoves = useMemo(() => {
    if (game.needsTurnConfirmation) {
      return [];
    }
    return game.getAllowedMoves();
  }, [game]);

  const { animatedBoard, mostRecentMove, replay } = useBoard({
    game,
    userActionState,
  });
  // const animatedBoard = useMemo(() => game.getV1Board(), [game]);
  // const mostRecentMove = undefined;

  return (
    <div
      className={
        isTutorial
          ? "flex flex-col w-[360px]"
          : classNames(
              "flex flex-col w-[360px] md:w-[600px] lg:w-[600px] overflow-x-hidden overflow-y-auto gap-1",
              className
            )
      }
    >
      <Reserve
        game={game}
        users={users}
        player={isFlipped ? defaultPlayerPOV : getOpponent(defaultPlayerPOV)}
        currentPlayer={currentPlayer}
        currentPlayerTurn={currentPlayerTurn}
        userActionState={userActionState}
        selectReserve={(kind) =>
          setUserActionState((userActionState) =>
            updateReserveClick(userActionState, kind, possibleAllowedMoves)
          )
        }
        sendChatMessage={(message) =>
          game.sendChatMessage({ message, time: Date.now() })
        }
        chatMessages={game.chatMessages}
        squareSize={squareSize}
      />
      <div className="flex flex-col">
        <Board
          game={game}
          board={animatedBoard}
          mostRecentMove={mostRecentMove}
          userActionState={userActionState}
          setUserActionState={setUserActionState}
          possibleAllowedMoves={possibleAllowedMoves}
          currentPlayer={currentPlayer}
          currentPlayerTurn={currentPlayerTurn}
          isFlipped={isFlipped}
          measureRef={measureRef}
          squareSize={squareSize}
          pieceSize={pieceSize}
        />
        <MoveProgressBar
          numMoves={
            !isReplayMode && currentPlayer === currentPlayerTurn
              ? game.numMovesThisTurn()
              : 0
          }
        />
      </div>
      <Reserve
        game={game}
        users={users}
        player={isFlipped ? getOpponent(defaultPlayerPOV) : defaultPlayerPOV}
        currentPlayer={currentPlayer}
        currentPlayerTurn={currentPlayerTurn}
        userActionState={userActionState}
        selectReserve={(kind) =>
          setUserActionState((userActionState) =>
            updateReserveClick(userActionState, kind, possibleAllowedMoves)
          )
        }
        sendChatMessage={(message) =>
          game.sendChatMessage({ message, time: Date.now() })
        }
        chatMessages={game.chatMessages}
        squareSize={squareSize}
      />
      <ControlsView
        game={game}
        seek={seek}
        cancel={() => setUserActionState({})}
        replay={() => replay()}
      />
    </div>
  );
}

function playerIdToPlayer(playerId: string): Player {
  return playerId === "0" ? "RED" : "BLUE";
}

function useBoardDimensions(preferSmall: boolean) {
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

  if (preferSmall) {
    return {
      measureRef,
      squareSize: squareSizes.small,
      pieceSize: pieceSizes.small,
    };
  }

  return { measureRef, squareSize, pieceSize };
}

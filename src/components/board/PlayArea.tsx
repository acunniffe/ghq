"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GHQState, hasMoveLimitReached, Player } from "@/game/engine";
import { BoardProps } from "boardgame.io/react";
import { getAllowedMoves, getOpponent } from "../../game/board-moves";

import { updateReserveClick, UserActionState } from "./state";
import Reserve from "./Reserve";
import Board from "./Board";
import classNames from "classnames";
import ControlsView from "./ControlsView";
import useBoard from "./useBoard";
import { Settings } from "./SettingsMenu";
import { useUsers } from "./useUsers";
import { hasMoveLimitReachedV2 } from "@/game/engine-v2";
import { pieceSizes } from "@/game/constants";
import { useMeasure } from "@uidotdev/usehooks";
import { squareSizes } from "@/game/constants";

export default function PlayArea(
  props: BoardProps<GHQState> & { className: string; settings: Settings }
) {
  const {
    ctx,
    G,
    matchData,
    playerID,
    className,
    moves,
    log,
    settings,
    sendChatMessage,
    chatMessages,
    plugins,
  } = props;
  const [userActionState, setUserActionState] = useState<UserActionState>({});
  const [viewPlayerPref, setViewPlayerPref] = useState<Player>("RED");
  const currentPlayerTurn = useMemo(
    () => playerIdToPlayer(ctx.currentPlayer),
    [ctx.currentPlayer]
  );
  const { measureRef, squareSize, pieceSize } = useBoardDimensions(
    G.isTutorial
  );

  // TODO(tyler): allow spectators to choose which side to view
  const defaultPlayerPOV = "RED";

  // Note: playerID is null in local play (non-multiplayer, non-bot), also when spectating, replaying, and tutorials.
  const currentPlayer = useMemo(() => {
    if (G.isReplayMode) {
      return defaultPlayerPOV;
    }
    return playerID === null ? currentPlayerTurn : playerIdToPlayer(playerID);
  }, [currentPlayerTurn, playerID, G.isReplayMode]);
  const { users } = useUsers({ G });

  const isFlipped = useMemo(() => viewPlayerPref === "BLUE", [viewPlayerPref]);

  useEffect(() => {
    // If G.isPassAndPlayMode, then viewPlayerPref should snap to currentPlayerTurn.
    if (G.isPassAndPlayMode && settings.autoFlipBoard && playerID === null) {
      setViewPlayerPref(currentPlayerTurn);
    } else if (playerID !== null) {
      setViewPlayerPref(playerIdToPlayer(playerID));
    }
  }, [G.isPassAndPlayMode, playerID, currentPlayerTurn, settings]);

  const possibleAllowedMoves = useMemo(() => {
    if (hasMoveLimitReachedV2(G)) {
      return [];
    }
    return getAllowedMoves({
      board: G.board,
      redReserve: G.redReserve,
      blueReserve: G.blueReserve,
      currentPlayerTurn,
      thisTurnMoves: G.thisTurnMoves,
      enforceZoneOfControl: G.enforceZoneOfControl,
      v2state: G.v2state,
      engine: plugins?.engine?.api,
    });
  }, [
    G.board,
    G.redReserve,
    G.blueReserve,
    currentPlayerTurn,
    G.thisTurnMoves,
    ctx,
  ]);

  // If the move limit has been reached and user has confirm disabled, automatically skip the turn.
  useEffect(() => {
    if (!settings.confirmTurn && hasMoveLimitReached(ctx)) {
      moves.Skip();
    }
  }, [ctx.numMoves]);

  const { board, mostRecentMove, replay } = useBoard({
    ctx,
    G,
    moves,
    userActionState,
    currentPlayer,
    currentPlayerTurn,
  });

  return (
    <div
      className={
        G.isTutorial
          ? "flex flex-col w-[360px]"
          : classNames(
              "flex flex-col w-[360px] md:w-[600px] lg:w-[600px] overflow-x-hidden overflow-y-auto gap-1",
              className
            )
      }
    >
      <Reserve
        G={G}
        ctx={ctx}
        matchData={matchData}
        player={isFlipped ? defaultPlayerPOV : getOpponent(defaultPlayerPOV)}
        currentPlayer={currentPlayer}
        currentPlayerTurn={currentPlayerTurn}
        users={users}
        userActionState={userActionState}
        selectReserve={(kind) =>
          setUserActionState((userActionState) =>
            updateReserveClick(userActionState, kind, possibleAllowedMoves)
          )
        }
        sendChatMessage={(message) =>
          sendChatMessage({ message, time: Date.now() })
        }
        chatMessages={chatMessages}
        squareSize={squareSize}
      />
      <Board
        G={G}
        ctx={ctx}
        log={log}
        board={board}
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
      <Reserve
        G={G}
        ctx={ctx}
        matchData={matchData}
        player={isFlipped ? getOpponent(defaultPlayerPOV) : defaultPlayerPOV}
        currentPlayer={currentPlayer}
        currentPlayerTurn={currentPlayerTurn}
        users={users}
        userActionState={userActionState}
        selectReserve={(kind) =>
          setUserActionState((userActionState) =>
            updateReserveClick(userActionState, kind, possibleAllowedMoves)
          )
        }
        sendChatMessage={(message) =>
          sendChatMessage({ message, time: Date.now() })
        }
        chatMessages={chatMessages}
        squareSize={squareSize}
      />
      <ControlsView
        {...props}
        isMyTurn={currentPlayer === currentPlayerTurn}
        hasMoveLimitReached={
          currentPlayer === currentPlayerTurn && hasMoveLimitReachedV2(G)
        }
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

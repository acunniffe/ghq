"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AllowedMove,
  Board,
  GHQState,
  isMoveCapture,
  isSkipMove,
  Player,
} from "@/game/engine";
import { UserActionState } from "./state";
import {
  playCaptureSound,
  playMoveSound,
  playNextTurnSound,
} from "@/game/audio";
import { GameClient } from "@/game/engine-v2";
import { allowedMoveToUci } from "@/game/notation-uci";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useBoard({
  game,
  userActionState,
}: {
  game: GameClient;
  userActionState: UserActionState;
}) {
  const [animatedBoard, setAnimatedBoard] = useState<Board>(game.getV1Board());
  const [mostRecentMove, setMostRecentMove] = useState<
    AllowedMove | undefined
  >();
  const skipAnimations = game.isReplayMode; // || G.isPassAndPlayMode;
  const currentPlayer = game.currentPlayer();
  const currentPlayerTurn = game.currentPlayerTurn();

  const animateOpponentsTurnToLatestBoardState = useCallback(() => {
    // Only animate when it's our turn (opponent's move has ended)
    if (game.isMyTurn()) {
      const lastTurnBoards = game.getLastTurnBoards();
      const lastTurnMoves = game.getLastTurnMoves();
      console.log("lastTurnBoards", lastTurnBoards);
      console.log("lastTurnMoves", lastTurnMoves.map(allowedMoveToUci));

      // Slowly re-apply the state to allow for animations.
      for (let i = 0; i < lastTurnBoards.length; i++) {
        sleep(i * 250).then(() => {
          setAnimatedBoard(lastTurnBoards[i]);

          const lastMove = lastTurnMoves[i];
          setMostRecentMove(lastMove);

          if (isMoveCapture(lastMove)) {
            playCaptureSound();
          } else if (!isSkipMove(lastMove)) {
            playMoveSound();
          }
        });
      }

      // Wait for all the animations to finish before setting the final board state.
      sleep(lastTurnBoards.length * 250).then(() => {
        setMostRecentMove(undefined);
        setAnimatedBoard(game.getV1Board());
      });
    }
  }, [currentPlayerTurn, currentPlayer, game.isMyTurn()]);

  // Change the board state when the current turn changes or it's game over.
  useEffect(() => {
    if (skipAnimations) {
      return;
    }

    animateOpponentsTurnToLatestBoardState();
  }, [currentPlayerTurn, game.gameover()]);

  useEffect(() => {
    // Animate when it's our turn (i.e. we just made move 1 or 2, or hit undo to go to move 0)
    if (currentPlayerTurn === currentPlayer && game.numMovesThisTurn() >= 0) {
      setAnimatedBoard(game.getV1Board());
    }

    // Also if it's our opponents turn and they have made 0 moves (i.e. we just made our move)
    if (!game.isMyTurn() && game.numMovesThisTurn() === 0) {
      setAnimatedBoard(game.getV1Board());
      playNextTurnSound();
    }
  }, [currentPlayerTurn, game]);

  // In replay mode, don't animate the board state when the game state changes, just set it immediately.
  useEffect(() => {
    if (skipAnimations) {
      setAnimatedBoard(game.getV1Board());
    }
  }, [skipAnimations, game]);

  // In replay mode, don't animate the board state when the game state changes, just set it immediately.
  useEffect(() => {
    if (skipAnimations) {
      const lastMove = game.moves[game.moves.length - 1];
      if (!lastMove) {
        return;
      }

      if (isMoveCapture(lastMove)) {
        playCaptureSound();
      } else if (!isSkipMove(lastMove)) {
        playMoveSound();
      }
    }
  }, [game]);

  // Actually make the move that's been chosen by the user.
  useEffect(() => {
    if (userActionState.chosenMove) {
      game.push(userActionState.chosenMove);

      if (isMoveCapture(userActionState.chosenMove)) {
        playCaptureSound();
      } else if (!isSkipMove(userActionState.chosenMove)) {
        playMoveSound();
      }
    }
  }, [userActionState.chosenMove]);

  // Play capture sounds when a start-of-turn capture has occurred.
  useEffect(() => {
    // TODO(tyler)
    // const startOfTurnCaptures = G.historyLog?.find(
    //   ({ turn, isCapture }) => turn === ctx.turn && isCapture
    // );
    // if (startOfTurnCaptures) {
    //   playCaptureSound();
    // }
  }, [game]);

  return {
    animatedBoard,
    mostRecentMove,
    replay: () => animateOpponentsTurnToLatestBoardState(),
  };
}

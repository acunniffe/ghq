"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AllowedMove,
  AnimatedMove,
  Board,
  hasMoveLimitReached,
  isMoveCapture,
  isSkipMove,
} from "@/game/engine";
import { UserActionState } from "./state";
import {
  playCaptureSound,
  playMoveSound,
  playNextTurnSound,
} from "@/game/audio";
import { GameClient } from "@/game/engine-v2";
import { Settings } from "./SettingsMenu";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ANIMATION_DELAY = 250;

export default function useBoard({
  game,
  settings,
  userActionState,
}: {
  game: GameClient;
  settings: Settings;
  userActionState: UserActionState;
}) {
  const [animatedBoard, setAnimatedBoard] = useState<Board>(game.getV1Board());
  const [animatedMoveIndex, setAnimatedMoveIndex] = useState<number>(
    game.moves.length
  );
  const [mostRecentMove, setMostRecentMove] = useState<
    AnimatedMove | undefined
  >();
  const [lastMove, setLastMove] = useState<AllowedMove | undefined>();
  const skipAnimations = game.isReplayMode; // || G.isPassAndPlayMode;
  const currentPlayer = game.currentPlayer();
  const currentPlayerTurn = game.currentPlayerTurn();

  const animateOpponentsTurnToLatestBoardState = useCallback(() => {
    // Only animate when it's our turn (opponent's move has ended)
    if (game.isMyTurn()) {
      const lastTurnBoards = game.getLastTurnBoards();
      const lastTurnMoves = game.getLastTurnMoves();

      // Slowly re-apply the state to allow for animations.
      for (let i = 0; i < lastTurnBoards.length; i++) {
        sleep(i * ANIMATION_DELAY).then(() => {
          setAnimatedBoard(lastTurnBoards[i]);

          const lastMove = lastTurnMoves[i];
          setMostRecentMove({ move: lastMove, reverse: false });

          if (isMoveCapture(lastMove)) {
            playCaptureSound();
          } else if (!isSkipMove(lastMove)) {
            playMoveSound();
          }
        });
      }

      // Wait for all the animations to finish before setting the final board state.
      sleep(lastTurnBoards.length * ANIMATION_DELAY).then(() => {
        setMostRecentMove(undefined);
        setAnimatedBoard(game.getV1Board());
      });
    }
  }, [currentPlayerTurn, currentPlayer, game.turn]);

  // Change the board state when the current turn changes or it's game over.
  useEffect(() => {
    if (skipAnimations) {
      return;
    }

    animateOpponentsTurnToLatestBoardState();
  }, [skipAnimations, game.turn]);

  useEffect(() => {
    if (game.isReplayMode) {
      return;
    }

    // Animate when it's our turn (i.e. we just made move 1 or 2, or hit undo to go to move 0)
    if (currentPlayerTurn === currentPlayer && game.numMovesThisTurn() >= 0) {
      setAnimatedBoard(game.getV1Board());
    }

    // Also if it's our opponents turn and they have made 0 moves (i.e. we just made our move)
    if (!game.isMyTurn() && game.numMovesThisTurn() === 0) {
      setAnimatedBoard(game.getV1Board());
      playNextTurnSound();
    }
  }, [currentPlayerTurn, game.moves, game.isReplayMode]);

  // In replay mode, animate single moves.
  useEffect(() => {
    if (game.isReplayMode) {
      const reverse = animatedMoveIndex > game.moves.length;

      // Account for whether we're moving forward or backward in the move history.
      if (reverse) {
        setMostRecentMove({ move: lastMove!, reverse });
      } else {
        setMostRecentMove({ move: game.moves[game.moves.length - 1], reverse });
      }

      setLastMove(game.moves[game.moves.length - 1]);

      sleep(150).then(() => {
        setAnimatedBoard(game.getV1Board());
        setAnimatedMoveIndex(game.moves.length);
        setMostRecentMove(undefined);
      });
    }
  }, [game.isReplayMode, game.moves]);

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
  }, [game.moves, skipAnimations]);

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

  // Clear bombardments for the user when the turn starts.
  useEffect(() => {
    if (game.isMyTurn()) {
      const cleared = game.clearBombardments();
      if (cleared) {
        playCaptureSound();
      }
    }
  }, [game.turn]);

  // If the move limit has been reached and user has confirm disabled, automatically skip the turn.
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  useEffect(() => {
    if (game.isMyTurn() && !settings.confirmTurn && !isEndingTurn) {
      setIsEndingTurn(true);
      setTimeout(() => {
        game.endTurn();

        setTimeout(() => {
          setIsEndingTurn(false);
        }, 1000); // NB(tyler): wait 1 second to prevent accidental skips
      }, 1);
    }
  }, [game.needsTurnConfirmation]);

  return {
    animatedBoard,
    mostRecentMove,
    replay: () => animateOpponentsTurnToLatestBoardState(),
  };
}

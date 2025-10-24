import { GameClient } from "@/game/engine-v2";
import { useCallback, useMemo, useState } from "react";

interface UseSeekOptions {
  realGame: GameClient | null;
  simGame: GameClient | null;
}

interface SeekParams {
  delta?: number;
  index?: number;
}

export type SeekFunc = (params: SeekParams) => void;

export default function useSeek({ realGame, simGame }: UseSeekOptions) {
  const [seekIndex, setSeekIndex] = useState(-1);
  const [showSim, setShowSim] = useState(false);

  const seek = useCallback(
    ({ delta, index }: SeekParams) => {
      if (!realGame || !simGame) {
        return;
      }

      const getSeekIndex = ({ delta, index }: SeekParams): number => {
        if (delta !== undefined) {
          // If we're at the start of the game and trying to go forward, set the seek index to the end of the game.
          if (seekIndex === -1 && delta > 0) {
            return realGame.moves.length + 1;
          }

          // Otherwise, just use the current seek index plus the delta.
          return seekIndex === -1
            ? realGame.moves.length - 1
            : seekIndex + delta;
        } else if (index !== undefined) {
          return index;
        }
        throw new Error("Either delta or index must be provided");
      };

      const newSeek = getSeekIndex({ delta, index });
      if (newSeek < 0) {
        return;
      }
      if (newSeek > realGame.moves.length) {
        setSeekIndex(-1); // Reset to "latest" rather than the last known index (which may change as game progresses)
        setShowSim(false);
        return;
      }
      simGame.applyMoves(realGame.pgn(), newSeek);
      setSeekIndex(newSeek);
      setShowSim(true);
    },
    [simGame, realGame, seekIndex, setSeekIndex, setShowSim]
  );

  const game = useMemo(() => {
    if (showSim) {
      return simGame;
    }
    return realGame;
  }, [showSim, realGame, simGame]);

  return { seek, seekIndex, game, showSim };
}

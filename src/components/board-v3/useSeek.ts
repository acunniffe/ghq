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
        setShowSim(false);
        return;
      }
      const pgn = realGame.pgn();
      const moves = pgn.split(" ").slice(0, newSeek).join(" ");
      simGame.applyMoves(moves);
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

  return { seek, game, showSim };
}

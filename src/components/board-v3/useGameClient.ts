import { useEffect, useMemo, useState } from "react";
import { GameClient, GameClientOptions } from "@/game/engine-v2";

export function useGameClient(opts: GameClientOptions): GameClient | null {
  const game = useMemo(() => {
    if (!opts.engine) return null;
    return new GameClient(opts);
  }, [opts.engine, opts.multiplayer]);

  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!game) return;

    return game.subscribe(() => {
      setVersion((v) => v + 1);
    });
  }, [game]);

  return game;
}

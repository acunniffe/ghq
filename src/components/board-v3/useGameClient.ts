import { useMemo, useRef, useState } from "react";
import { GameClient, GameEngine } from "@/game/engine-v2";

interface UseGameClientOptions {
  engine: GameEngine | null;
  isTutorial: boolean;
  isReplayMode?: boolean;
  isPassAndPlayMode?: boolean;
  id?: string;
}

export function useGameClient({
  engine,
  isTutorial,
  isReplayMode = false,
  isPassAndPlayMode = true,
}: UseGameClientOptions): GameClient | null {
  const [version, setVersion] = useState(0);
  const wrappedOnceRef = useRef(false);

  const gameClient = useMemo(() => {
    if (!engine) return null;
    return new GameClient({
      engine,
      isTutorial,
      isReplayMode,
      isPassAndPlayMode,
    });
  }, [engine, isTutorial, isReplayMode, isPassAndPlayMode]);

  if (gameClient && !wrappedOnceRef.current) {
    const originalPush = gameClient.push.bind(gameClient);
    const originalUndo = gameClient.undo.bind(gameClient);
    const originalRedo = gameClient.redo.bind(gameClient);
    const originalEndTurn = gameClient.endTurn.bind(gameClient);
    const originalApplyMoves = gameClient.applyMoves.bind(gameClient);

    gameClient.push = (...args: Parameters<typeof gameClient.push>) => {
      originalPush(...args);
      setVersion((v) => v + 1);
    };

    gameClient.undo = () => {
      originalUndo();
      setVersion((v) => v + 1);
    };

    gameClient.redo = () => {
      originalRedo();
      setVersion((v) => v + 1);
    };

    gameClient.endTurn = () => {
      originalEndTurn();
      setVersion((v) => v + 1);
    };

    gameClient.applyMoves = (
      ...args: Parameters<typeof gameClient.applyMoves>
    ) => {
      originalApplyMoves(...args);
      setVersion((v) => v + 1);
    };

    wrappedOnceRef.current = true;
  }

  return useMemo(() => {
    if (!gameClient) return null;
    return new Proxy(gameClient, {
      get(target, prop) {
        return target[prop as keyof GameClient];
      },
    });
  }, [gameClient, version]);
}

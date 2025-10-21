"use client";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useMemo, useState } from "react";
import { Settings } from "./SettingsMenu";
import { useLatestMoveContext } from "@/components/LatestMoveContext";
import MobileHeader from "../MobileHeader";
import { GameEngine } from "@/game/engine-v2";
import { Loader2 } from "lucide-react";
import { useGameClient } from "./useGameClient";
import useSeek from "./useSeek";
import { cn } from "@/lib/utils";

interface GHQBoardV3Props {
  engine: GameEngine | null;
  isTutorial: boolean;
}

export function GHQBoardV3({ engine, isTutorial }: GHQBoardV3Props) {
  const [settings, setSettings] = useState<Settings>({
    autoFlipBoard: false,
    confirmTurn: true,
  });

  const realGame = useGameClient({
    engine,
    isTutorial,
    isReplayMode: false,
    isPassAndPlayMode: true,
  });

  const simGame = useGameClient({
    engine,
    isTutorial: false,
    isReplayMode: true,
    isPassAndPlayMode: false,
  });

  const { seek, game, showSim } = useSeek({ realGame, simGame });

  // const { setBoard, setMoves } = useLatestMoveContext();

  // useEffect(() => {
  //   setBoard(props.G.board);
  //   setMoves(props.log || []);
  // }, [props.G.board, props.log]);

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-32 w-32 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col md:flex-row", showSim ? "bg-gray-100" : "")}
    >
      <div className="block sm:hidden mb-1">
        <MobileHeader />
      </div>
      {!isTutorial && (
        <Sidebar
          game={game}
          seek={seek}
          className="order-3 md:order-1 mt-8 md:mt-0"
          settings={settings}
          setSettings={setSettings}
        />
      )}
      <PlayArea
        className="order-1 md:order-2 m-auto"
        game={game}
        seek={seek}
        settings={settings}
      />
      <GameoverDialog game={game} />
    </div>
  );
}

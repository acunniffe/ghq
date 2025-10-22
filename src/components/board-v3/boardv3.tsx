"use client";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useState } from "react";
import { Settings } from "./SettingsMenu";
import MobileHeader from "../MobileHeader";
import { GameClientOptions, useEngine } from "@/game/engine-v2";
import { Loader2 } from "lucide-react";
import { useGameClient } from "./useGameClient";
import useSeek from "./useSeek";
import { cn } from "@/lib/utils";
import {
  BotMultiplayer,
  Multiplayer,
  OnlineMultiplayer,
} from "@/game/engine-v2-multiplayer";
import { useAuth } from "@clerk/nextjs";

export interface GHQBoardV3Props extends GameClientOptions {
  bot?: boolean;
  credentials?: string;
}

export function GHQBoardV3(opts: GHQBoardV3Props) {
  const { engine } = useEngine();
  const { isSignedIn, getToken } = useAuth();
  const [multiplayer, setMultiplayer] = useState<Multiplayer | undefined>(
    undefined
  );

  const [settings, setSettings] = useState<Settings>({
    autoFlipBoard: false,
    confirmTurn: true,
  });

  useEffect(() => {
    if (!engine) {
      return;
    }

    if (opts.bot) {
      const multiplayer = new BotMultiplayer(engine, opts.fen);
      setMultiplayer(multiplayer);
      return;
    }

    if (opts.credentials && opts.id && isSignedIn && opts.playerId) {
      const multiplayer = new OnlineMultiplayer(
        opts.id,
        opts.credentials,
        opts.playerId,
        getToken
      );
      setMultiplayer(multiplayer);
      return () => {
        multiplayer.disconnect();
      };
    }
  }, [opts.bot, opts.fen, engine, isSignedIn, getToken]);

  const realGame = useGameClient({
    ...opts,
    engine,
    multiplayer,
  });

  const simGame = useGameClient({
    ...opts,
    engine,
    isReplayMode: true,
    isPassAndPlayMode: true,
  });

  // Hack so we can debug in the console
  if (typeof window !== "undefined") {
    (window as any).realGame = realGame;
    (window as any).simGame = simGame;
  }

  const { seek, game, showSim } = useSeek({ realGame, simGame });

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-lg font-bold text-blue-500">
          Loading GHQ Game Engine...
        </div>
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
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
      {!opts.isTutorial && (
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

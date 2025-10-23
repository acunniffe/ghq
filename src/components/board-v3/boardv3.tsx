"use client";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useMemo, useState } from "react";
import { Settings } from "./SettingsMenu";
import MobileHeader from "../MobileHeader";
import { GameClientOptions, useEngine } from "@/game/engine-v2";
import { useGameClient } from "./useGameClient";
import useSeek from "./useSeek";
import { cn } from "@/lib/utils";
import {
  BotMultiplayer,
  Multiplayer,
  OnlineMultiplayer,
} from "@/game/engine-v2-multiplayer";
import { useAuth } from "@clerk/nextjs";
import GameLoader from "./GameLoader";
import { MatchV3 } from "@/lib/types";
import { useUsers } from "./useUsers";

export interface GHQBoardV3Props extends GameClientOptions {
  bot?: boolean;
  credentials?: string;
  match?: MatchV3;
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

    if (
      opts.credentials !== undefined &&
      opts.id &&
      isSignedIn &&
      opts.playerId
    ) {
      const multiplayer = new OnlineMultiplayer(
        opts.id,
        opts.credentials,
        opts.playerId,
        getToken
      );
      setMultiplayer(multiplayer);
      console.log("creating multipler");
      return () => {
        console.log("Disconnecting multiplayer");
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

  const userIds = useMemo(() => {
    if (opts.match) {
      return [opts.match.player0UserId, opts.match.player1UserId];
    }
    return [];
  }, [opts.match]);
  const { users } = useUsers({ userIds });

  // Hack so we can debug in the console
  if (typeof window !== "undefined") {
    (window as any).realGame = realGame;
    (window as any).simGame = simGame;
  }

  const { seek, seekIndex, game, showSim } = useSeek({ realGame, simGame });

  if (!game) {
    return <GameLoader message="Loading engine..." />;
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
          game={realGame || game}
          seek={seek}
          seekIndex={seekIndex}
          className="order-3 md:order-1 mt-8 md:mt-0"
          settings={settings}
          setSettings={setSettings}
        />
      )}
      <PlayArea
        match={opts.match}
        className="order-1 md:order-2 m-auto"
        game={game}
        users={users}
        seek={seek}
        settings={settings}
      />
      <GameoverDialog
        game={realGame || game}
        match={opts.match}
        users={users}
      />
    </div>
  );
}

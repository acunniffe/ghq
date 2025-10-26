"use client";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "./SettingsMenu";
import MobileHeader from "../MobileHeader";
import { GameClient, GameClientOptions, useEngine } from "@/game/engine-v2";
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
import { GameoverState } from "@/game/engine";

export interface GHQBoardV3Props extends GameClientOptions {
  bot?: boolean;
  credentials?: string;
  match?: MatchV3;
}

// TODO(tyler): ability to load a game from a PGN

export function GHQBoardV3(opts: GHQBoardV3Props) {
  const { engine } = useEngine();
  const { isSignedIn, getToken } = useAuth();
  const [multiplayer, setMultiplayer] = useState<Multiplayer | undefined>(
    undefined
  );

  const [settings, setSettings] = useState<Settings>({
    autoFlipBoard: false,
    undoWithMouse: false,
  });

  useEffect(() => {
    if (!engine) {
      return;
    }

    if (opts.bot && opts.id) {
      const multiplayer = new BotMultiplayer(engine, opts.id, opts.fen);
      setMultiplayer(multiplayer);
      return;
    }

    if (
      opts.credentials !== undefined &&
      opts.id &&
      isSignedIn !== undefined &&
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
  }, [opts.bot, opts.id, opts.fen, engine, isSignedIn, getToken]);

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

  const gameover = useMemo(() => {
    return getGameover(realGame, opts.match);
  }, [realGame, opts.match, realGame?.ended]);

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
          activeGame={game}
          seek={seek}
          gameover={gameover}
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
        gameover={gameover}
        users={users}
      />
    </div>
  );
}

function getGameover(
  game: GameClient | null,
  match?: MatchV3
): GameoverState | undefined {
  if (!game) {
    return undefined;
  }

  // If the game was aborted, we can show that first
  if (match?.status === "ABORTED") {
    return {
      winner: undefined,
      status: "DRAW",
      reason: "Game was abandoned",
    };
  }

  // If the match object from the database is available, use it to get the gameover state first.
  if (match?.status && match.gameoverReason) {
    const winner =
      match.status === "WIN"
        ? match.player0UserId === match.winnerUserId
          ? "RED"
          : "BLUE"
        : undefined;
    return {
      winner,
      status: match.status as "WIN" | "DRAW",
      reason: match.gameoverReason,
    };
  }

  // Otherwise use the gameover from the game client.
  return game.gameover();
}

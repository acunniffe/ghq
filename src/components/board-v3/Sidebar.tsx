"use client";

import React, { useMemo } from "react";
import classNames from "classnames";
import { HistoryLog } from "./HistoryLog";
import EvalBar from "../../game/EvalBar";

import Header from "@/components/Header";
import HomeButton from "./HomeButton";
import ResignButton from "./ResignButton";
import AbandonButton from "./AbandonButton";
import SettingsMenu, { Settings } from "./SettingsMenu";
import { Swords } from "lucide-react";
import { config } from "@/lib/config";
import { GameClient } from "@/game/engine-v2";
import ShareGameDialog from "./ShareGameDialog";
import { SeekFunc } from "./useSeek";

export default function Sidebar({
  game,
  seek,
  className,
  settings,
  setSettings,
}: {
  game: GameClient;
  seek: SeekFunc;
  className: string;
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  const currentPlayerTurn = useMemo(() => game.currentPlayerTurn(), [game]);
  const currentPlayer = useMemo(() => game.currentPlayer(), [game]);
  const movesLeft = useMemo(() => 3 - game.numMovesThisTurn(), [game]);

  const historyEval = useMemo(() => {
    return (
      <>
        <EvalBar evalValue={game.eval()} />
        <HistoryLog game={game} seek={seek} />
      </>
    );
  }, [game]);

  const gameover = useMemo(() => game.gameover(), [game]);

  return (
    <div
      className={classNames(
        "w-full md:w-[450px] bg-white/80 h-screen shadow-lg transition-shadow duration-300 shadow-slate-400 space-y-3",
        className
      )}
    >
      <div className="hidden sm:block">
        <Header />
      </div>
      {historyEval}
      {gameover ? (
        <div className="flex flex-col items-center justify-center gap-0 justify-center items-center">
          <h2
            className={classNames(
              "text-center font-bold",
              gameover.status === "DRAW" && "text-gray-800",
              gameover.status === "WIN" && gameover.winner === "RED"
                ? "text-red-500"
                : "text-blue-500"
            )}
          >
            {gameover.status === "DRAW" ? (
              "Draw!"
            ) : (
              <>{gameover.winner === "RED" ? "Red" : "Blue"} Won!</>
            )}
          </h2>
          <div className="text-center text-gray-600">
            {gameover.reason && gameover.reason}
          </div>
          <div className="flex gap-1">
            <ShareGameDialog game={game} />
            <HomeButton />
          </div>
        </div>
      ) : (
        <div className="text-center flex items-center flex-col justify-center flex-1">
          <div
            className={classNames(
              game.currentPlayer() === "RED" ? "text-red-500" : "text-blue-500",
              "flex items-center gap-1"
            )}
          >
            <div className="flex items-center gap-1 font-semibold">
              <Swords className="w-5 h-5" /> {game.currentTurn()}{" "}
            </div>
            <div>
              {currentPlayer === currentPlayerTurn ? "Your" : "Their"} Turn
            </div>
          </div>
          <div className="text-gray-600 flex gap-1 justify-center items-center font-medium">
            {movesLeft} remaining move
            {movesLeft !== 1 ? "s" : ""}{" "}
          </div>
          <div className="flex gap-1 justify-center items-center">
            {currentPlayer === currentPlayerTurn || !game.isOnline ? (
              <>
                {/* {G.drawOfferedBy && G.drawOfferedBy !== ctx.currentPlayer ? (
                  <AcceptDrawButton draw={() => moves.AcceptDraw()} />
                ) : (
                  <OfferDrawButton
                    draw={(offer: boolean) => moves.OfferDraw(offer)}
                  />
                )} */}
                <ResignButton resign={() => game.resign()} />
                <ShareGameDialog game={game} />
                <SettingsMenu settings={settings} setSettings={setSettings} />
              </>
            ) : (
              <>
                {config.useClerk && game.id && (
                  <AbandonButton matchId={game.id} />
                )}
                <ShareGameDialog game={game} />
                <SettingsMenu settings={settings} setSettings={setSettings} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

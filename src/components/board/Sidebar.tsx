"use client";

import React, { useMemo } from "react";
import { GHQState, Player } from "@/game/engine";
import { BoardProps } from "boardgame.io/react";
import classNames from "classnames";
import { HistoryLog } from "../../game/HistoryLog";
import EvalBar from "../../game/EvalBar";

import Header from "@/components/Header";
import ShareGameDialog from "../../game/ExportGameDialog";
import HowToPlayView from "../../game/HowToPlayView";
import HomeButton from "./HomeButton";
import ResignButton from "./ResignButton";
import AbandonButton from "./AbandonButton";
import SettingsMenu, { Settings } from "./SettingsMenu";
import { Swords } from "lucide-react";
import { Ctx } from "boardgame.io";

export default function Sidebar({
  G,
  ctx,
  playerID,
  moves,
  log,
  className,
  settings,
  setSettings,
}: BoardProps<GHQState> & {
  className: string;
  settings: Settings;
  setSettings: (settings: Settings) => void;
  ctx: Ctx;
}) {
  const currentPlayerTurn = useMemo(
    () => playerIdToPlayer(ctx.currentPlayer),
    [ctx.currentPlayer]
  );
  const currentPlayer = useMemo(
    () => (playerID === null ? currentPlayerTurn : playerIdToPlayer(playerID)),
    [currentPlayerTurn, playerID]
  );

  const historyEval = useMemo(() => {
    return (
      <>
        <EvalBar evalValue={G.eval} />
        <HistoryLog
          systemMessages={G.historyLog}
          log={log}
          gameover={ctx.gameover}
        />
      </>
    );
  }, [ctx.turn, ctx.gameover]);

  return (
    <div className={classNames("w-full md:w-[450px] bg-white", className)}>
      <Header />
      {historyEval}
      {ctx.gameover ? (
        <div className="flex flex-col items-center justify-center gap-1 justify-center items-center">
          <h2
            className={classNames(
              "text-center font-semibold text-2xl",
              ctx.gameover.status === "DRAW" && "text-gray-800",
              ctx.gameover.status === "WIN" && ctx.gameover.winner === "RED"
                ? "text-red-500"
                : "text-blue-500"
            )}
          >
            {ctx.gameover.status === "DRAW" ? (
              "Draw!"
            ) : (
              <>{ctx.gameover.winner === "RED" ? "Red " : "Blue"} Won!</>
            )}
          </h2>
          {ctx.gameover.reason && ctx.gameover.reason}
          <div className="flex gap-1">
            <ShareGameDialog G={G} ctx={ctx} log={log} />
            <HomeButton />
          </div>
        </div>
      ) : (
        <div className="text-center flex items-center flex-col justify-center flex-1">
          <div
            className={classNames(
              ctx.currentPlayer === "0" ? "text-red-500" : "text-blue-500",
              "flex items-center gap-1"
            )}
          >
            <div className="flex items-center gap-1 font-semibold">
              <Swords className="w-5 h-5" /> {ctx.turn}{" "}
            </div>
            <div>
              {currentPlayer === currentPlayerTurn ? "Your" : "Their"} Turn
            </div>
          </div>
          <div className="text-gray-600 flex gap-1 justify-center items-center font-medium">
            {3 - ctx.numMoves!} remaining move
            {ctx.numMoves !== 2 ? "s" : ""}{" "}
          </div>
          <div className="flex gap-1 justify-center items-center">
            {currentPlayer === currentPlayerTurn || !G.isOnline ? (
              <>
                {/* {G.drawOfferedBy && G.drawOfferedBy !== ctx.currentPlayer ? (
                  <AcceptDrawButton draw={() => moves.AcceptDraw()} />
                ) : (
                  <OfferDrawButton
                    draw={(offer: boolean) => moves.OfferDraw(offer)}
                  />
                )} */}
                <ResignButton resign={() => moves.Resign()} />
                <ShareGameDialog G={G} ctx={ctx} log={log} />
                <SettingsMenu settings={settings} setSettings={setSettings} />
              </>
            ) : (
              <>
                <AbandonButton matchId={G.matchId} />
                <ShareGameDialog G={G} ctx={ctx} log={log} />
                <SettingsMenu settings={settings} setSettings={setSettings} />
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <HowToPlayView />
      </div>
    </div>
  );
}

function playerIdToPlayer(playerId: string): Player {
  return playerId === "0" ? "RED" : "BLUE";
}

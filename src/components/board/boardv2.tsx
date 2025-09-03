"use client";

import { GHQState } from "@/game/engine";
import { BoardProps } from "boardgame.io/react";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useMemo, useState } from "react";
import { Settings } from "./SettingsMenu";
import { useLatestMoveContext } from "@/components/LatestMoveContext";
import MobileHeader from "../MobileHeader";
import BackgroundPicture from "../BackgroundPicture";
import { getAllowedMoves } from "@/game/board-moves";
import { hasMoveLimitReachedV2 } from "@/game/engine-v2";

export function GHQBoardV2(props: BoardProps<GHQState>) {
  const [settings, setSettings] = useState<Settings>({
    autoFlipBoard: false,
    confirmTurn: true,
  });
  const { isTutorial } = props.G;

  const { setBoard, setMoves } = useLatestMoveContext();

  useEffect(() => {
    setBoard(props.G.board);
    setMoves(props.log || []);
  }, [props.G.board, props.log]);

  const showBackground = useMemo(() => {
    return props.G.isReplayMode || props.ctx.gameover;
  }, [props.G.isReplayMode, props.ctx.gameover]);

  const currentPlayerTurn = useMemo(() => {
    return props.ctx.currentPlayer === "0" ? "RED" : "BLUE";
  }, [props.ctx.currentPlayer]);

  const possibleAllowedMoves = useMemo(() => {
    const moves = getAllowedMoves({
      board: props.G.board,
      redReserve: props.G.redReserve,
      blueReserve: props.G.blueReserve,
      currentPlayerTurn,
      thisTurnMoves: props.G.thisTurnMoves,
      enforceZoneOfControl: props.G.enforceZoneOfControl,
      v2state: props.G.v2state,
      engine: props.plugins?.engine?.api,
    });
    
    if (hasMoveLimitReachedV2(props.G, currentPlayerTurn, moves)) {
      return [];
    }
    return moves;
  }, [
    props.G.board,
    props.G.redReserve,
    props.G.blueReserve,
    currentPlayerTurn,
    props.G.thisTurnMoves,
    props.G.enforceZoneOfControl,
    props.G.v2state,
    props.plugins?.engine?.api,
  ]);

  return (
    <div className="flex flex-col md:flex-row">
      {showBackground && <BackgroundPicture src="/bg-bombs.png" opacity={40} />}
      <div className="block sm:hidden mb-1">
        <MobileHeader />
      </div>
      {!isTutorial && (
        <Sidebar
          className="order-3 md:order-1 mt-8 md:mt-0"
          {...props}
          settings={settings}
          setSettings={setSettings}
          possibleAllowedMoves={possibleAllowedMoves}
        />
      )}
      <PlayArea
        className="order-1 md:order-2 m-auto"
        {...props}
        settings={settings}
        possibleAllowedMoves={possibleAllowedMoves}
      />
      <GameoverDialog
        G={props.G}
        ctx={props.ctx}
        gameover={props.ctx.gameover}
        log={props.log}
      />
    </div>
  );
}

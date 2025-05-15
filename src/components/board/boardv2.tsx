"use client";

import { GHQState } from "@/game/engine";
import { BoardProps } from "boardgame.io/react";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useState } from "react";
import { Settings } from "./SettingsMenu";
import { useLatestMoveContext } from "@/components/LatestMoveContext";

export function GHQBoardV2(props: BoardProps<GHQState>) {
  const [settings, setSettings] = useState<Settings>({
    autoFlipBoard: true,
    confirmTurn: true,
  });
  const { isTutorial } = props.G;

  const { setBoard, setMoves } = useLatestMoveContext();

  useEffect(() => {
    setBoard(props.G.board);
    setMoves(props.log || []);
  }, [props.G.board, props.log]);

  return (
    <div className="flex flex-col md:flex-row">
      {!isTutorial && (
        <Sidebar
          className="order-3 md:order-1"
          {...props}
          settings={settings}
          setSettings={setSettings}
        />
      )}
      <PlayArea
        className="order-1 md:order-2 m-auto"
        {...props}
        settings={settings}
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

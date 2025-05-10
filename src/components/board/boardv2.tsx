"use client";

import { GHQState } from "@/game/engine";
import { BoardProps } from "boardgame.io/react";

import PlayArea from "./PlayArea";
import Sidebar from "./Sidebar";
import GameoverDialog from "./GameoverDialog";
import { useEffect, useState } from "react";
import { Settings } from "./SettingsMenu";
import { useLatestMoveContext } from "@/components/LatestMoveContext";
import { useHotkeys } from "react-hotkeys-hook";
import { allowedMoveFromUci } from "@/game/notation-uci";
import movesUCI from "@/game/test-game-moves.json";

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

  const [moveIndex, setMoveIndex] = useState(0);

  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      const move = movesUCI[moveIndex];
      const moveUCI = allowedMoveFromUci(move);

      console.log(move, moveUCI);

      if (moveUCI.name === "Move") {
        props.moves.Move(moveUCI.args[0], moveUCI.args[1]);
      } else if (moveUCI.name === "MoveAndOrient") {
        props.moves.MoveAndOrient(
          moveUCI.args[0],
          moveUCI.args[1],
          moveUCI.args[2]
        );
      } else if (moveUCI.name === "Reinforce") {
        props.moves.Reinforce(
          moveUCI.args[0],
          moveUCI.args[1],
          moveUCI.args[2]
        );
      } else if (moveUCI.name === "Skip") {
        props.moves.Skip();
      } else if (moveUCI.name === "AutoCapture") {
        console.log(
          "auto capture",
          moveUCI.args[0],
          moveUCI.args[1],
          moveUCI.args[2]
        );
      }
      setMoveIndex(moveIndex + 1);
    },
    [props.moves, moveIndex]
  );

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
      />
    </div>
  );
}

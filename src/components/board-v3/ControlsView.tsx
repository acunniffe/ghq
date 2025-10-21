import { Redo, Repeat, SkipForward, Undo } from "lucide-react";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useControls from "./Controls";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { GameClient } from "@/game/engine-v2";

export default function ControlsView({
  realGame: game,
  simGame,
  setShowSim,
  replay,
  cancel,
}: {
  realGame: GameClient;
  simGame: GameClient;
  setShowSim: (show: boolean) => void;
  replay: () => void;
  cancel: () => void;
}) {
  const canReplay = useMemo(
    () => game.isMyTurn() && game.currentTurn() > 1,
    [game]
  );

  const doUndo = useCallback(() => {
    if (game.canUndo()) {
      game.undo();
    }
    cancel();
  }, [game, cancel]);

  const doRedo = useCallback(() => {
    if (game.canRedo()) {
      game.redo();
    }
  }, [game]);

  const doSkip = useCallback(() => {
    if (game.canEndTurn()) {
      game.endTurn();
    }
  }, [game]);

  const doReplay = useCallback(() => {
    if (canReplay) {
      replay();
    }
    cancel();
  }, [replay, cancel]);

  const [seekIndex, setSeekIndex] = useState(-1);
  const doSeek = useCallback(
    (delta: number) => {
      const newSeek =
        seekIndex === -1 ? game.moves.length - 1 : seekIndex + delta;
      if (newSeek < 0) {
        return;
      }
      if (newSeek > game.moves.length) {
        return;
      }
      const pgn = game.pgn();
      const moves = pgn.split(" ").slice(0, newSeek).join(" ");
      simGame.applyMoves(moves);
      setSeekIndex(newSeek);
      setShowSim(true);
    },
    [simGame, game, seekIndex, setSeekIndex, setShowSim]
  );

  useControls({
    undo: doUndo,
    redo: doRedo,
    cancel,
    skip: doSkip,
    replay: doReplay,
    backward: () => doSeek(-1),
    forward: () => doSeek(1),
  });

  return (
    <div className="flex gap-1 m-1">
      <ActionButton
        Icon={Undo}
        tooltip="Undo the most recent move you made this turn (shortcut: left-arrow)"
        onClick={doUndo}
        disabled={!game.canUndo()}
      />
      <ActionButton
        Icon={Redo}
        tooltip="Redo the most recent move you undid this turn (shortcut: right-arrow)"
        onClick={doRedo}
        disabled={!game.canRedo()}
      />
      <ActionButton
        Icon={SkipForward}
        tooltip='Skip or confirm the remainder of your turn. If both players skip without making any moves, the game is a draw. (shortcut: ".")'
        onClick={doSkip}
        disabled={!game.canEndTurn()}
        className={
          game.needsTurnConfirmation
            ? "border-blue-800 bg-blue-200 text-blue-800 hover:bg-blue-100 transition-colors duration-200"
            : ""
        }
      />
      <ActionButton
        Icon={Repeat}
        tooltip="Replay the animation of your opponent's most recent turn (shortcut: spacebar)"
        onClick={doReplay}
        disabled={!canReplay}
      />
    </div>
  );
}

function ActionButton({
  Icon,
  tooltip,
  onClick,
  disabled,
  className,
}: {
  Icon: React.FC;
  tooltip: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full", className ?? "")}
            onClick={onClick}
            disabled={disabled}
          >
            <Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

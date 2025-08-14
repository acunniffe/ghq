import { Redo, Repeat, SkipForward, Undo } from "lucide-react";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useControls from "./Controls";
import { BoardProps } from "boardgame.io/react";
import { GHQState } from "@/game/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ctx, LogEntry } from "boardgame.io";
import { cn } from "@/lib/utils";

export default function ControlsView({
  ctx,
  undo,
  redo,
  replay,
  moves,
  isMyTurn,
  cancel,
  hasMoveLimitReached,
}: {
  ctx: Ctx;
  undo: () => void;
  redo: () => void;
  replay: () => void;
  cancel: () => void;
  log: LogEntry[];
  moves: BoardProps<GHQState>["moves"];
  isMyTurn: boolean;
  hasMoveLimitReached: boolean;
}) {
  const [undoneMoves, setUndoneMoves] = useState<number>(0);
  const canUndo = useMemo(
    () => isMyTurn && ctx.numMoves && ctx.numMoves >= 0,
    [ctx.numMoves, isMyTurn]
  );
  const canRedo = useMemo(
    () => isMyTurn && undoneMoves > 0,
    [isMyTurn, undoneMoves]
  );
  const canSkip = useMemo(() => isMyTurn, [ctx.numMoves, isMyTurn]);
  const canReplay = useMemo(
    () => isMyTurn && ctx.turn > 1,
    [ctx.turn, isMyTurn]
  );

  useEffect(() => {
    if (isMyTurn) {
      setUndoneMoves(0);
    }
  }, [isMyTurn]);

  const doUndo = useCallback(() => {
    if (canUndo) {
      undo();
      setUndoneMoves((v) => v + 1);
    }
    cancel();
  }, [canUndo, undo, cancel, setUndoneMoves]);

  const doRedo = useCallback(() => {
    if (canRedo) {
      redo();
      setUndoneMoves((v) => v - 1);
    }
  }, [canRedo, redo, setUndoneMoves]);

  const doSkip = useCallback(() => {
    if (canSkip) {
      moves.Skip();
    }
  }, [canSkip, moves]);

  const doReplay = useCallback(() => {
    if (canReplay) {
      replay();
    }
    cancel();
  }, [replay, cancel]);

  useControls({
    undo: doUndo,
    redo: doRedo,
    cancel,
    skip: doSkip,
    replay: doReplay,
  });

  return (
    <div className="flex gap-1 m-1">
      <ActionButton
        Icon={Undo}
        tooltip="Undo the most recent move you made this turn (shortcut: left-arrow)"
        onClick={doUndo}
        disabled={!canUndo}
      />
      <ActionButton
        Icon={Redo}
        tooltip="Redo the most recent move you undid this turn (shortcut: right-arrow)"
        onClick={doRedo}
        disabled={!canRedo}
      />
      <ActionButton
        Icon={SkipForward}
        tooltip='Skip or confirm the remainder of your turn. If both players skip without making any moves, the game is a draw. (shortcut: ".")'
        onClick={doSkip}
        disabled={!canSkip}
        className={
          hasMoveLimitReached
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

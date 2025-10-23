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
import { GameClient, Player } from "@/game/engine-v2";
import { SeekFunc } from "./useSeek";
import { Kbd } from "../ui/kbd";

export default function ControlsView({
  game,
  replay,
  seek,
  cancel,
  togglePOV,
}: {
  game: GameClient;
  replay: () => void;
  seek: SeekFunc;
  cancel: () => void;
  togglePOV: () => void;
}) {
  const canReplay = useMemo(
    () => game.isMyTurn() && game.turn > 1,
    [game.turn]
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

  useControls({
    undo: doUndo,
    redo: doRedo,
    cancel,
    skip: doSkip,
    replay: doReplay,
    backward: () => seek({ delta: -1 }),
    forward: () => seek({ delta: 1 }),
    togglePOV,
  });

  // TODO(tyler): after game is over, we can just have forward/backward buttons

  return (
    <div className="flex flex-wrap gap-1 m-1 justify-center">
      {game.isReplayMode || game.ended ? (
        <>
          <ActionButton
            text="Previous"
            tooltip="Go back one move"
            onClick={() => seek({ delta: -1 })}
            disabled={false}
            shortcut="↑"
          />
          <ActionButton
            text="Next"
            tooltip="Go forward one move"
            onClick={() => seek({ delta: 1 })}
            disabled={false}
            shortcut="↓"
          />
        </>
      ) : (
        <>
          <ActionButton
            text="Undo"
            tooltip="Undo your last move"
            onClick={doUndo}
            disabled={!game.canUndo()}
            shortcut="←"
          />
          <ActionButton
            text="Redo"
            tooltip="Redo your last undo"
            onClick={doRedo}
            disabled={!game.canRedo()}
            shortcut="→"
          />
          <ActionButton
            text={game.needsTurnConfirmation ? "Confirm" : "Skip"}
            tooltip="Skip or confirm remainder of turn. If both players skip, it's a draw"
            onClick={doSkip}
            disabled={!game.canEndTurn()}
            shortcut="⏎"
            className={
              game.needsTurnConfirmation
                ? "border-blue-800 bg-blue-200 text-blue-800 hover:bg-blue-100 transition-colors duration-200"
                : ""
            }
          />
          <ActionButton
            text="Replay"
            tooltip="Replay animation of opponent's last turn"
            onClick={doReplay}
            disabled={!canReplay}
            shortcut="␣"
          />
        </>
      )}
    </div>
  );
}

function ActionButton({
  text,
  tooltip,
  onClick,
  disabled,
  className,
  shortcut,
}: {
  text: string;
  tooltip: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
  shortcut?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={cn("", className ?? "")}
            onClick={onClick}
            disabled={disabled}
          >
            {text}
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

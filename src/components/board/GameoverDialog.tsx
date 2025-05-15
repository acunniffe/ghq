import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameoverState, GHQState } from "@/game/engine";
import { useEffect, useState } from "react";
import HomeButton from "./HomeButton";
import ShareGameDialog from "@/game/ExportGameDialog";
import { Ctx, LogEntry } from "boardgame.io";

export default function GameoverDialog({
  gameover,
  G,
  ctx,
  log,
}: {
  G: GHQState;
  gameover?: GameoverState;
  ctx: Ctx;
  log: LogEntry[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!!gameover);
  }, [gameover]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game ended</DialogTitle>
          <DialogDescription></DialogDescription>
          <div className="flex flex-col gap-2">
            <div>
              {gameover?.winner
                ? `${toTitleCase(gameover.winner)} won ${gameover.reason}!`
                : "Game ended in a draw"}
            </div>

            <div className="flex gap-1">
              <ShareGameDialog G={G} ctx={ctx} log={log} />
              <HomeButton />
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

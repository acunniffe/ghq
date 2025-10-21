import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import HomeButton from "./HomeButton";
import ShareGameDialog from "./ShareGameDialog";
import { GameClient } from "@/game/engine-v2";

export default function GameoverDialog({ game }: { game: GameClient }) {
  const [open, setOpen] = useState(false);

  const gameover = game.gameover();

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
                : `Game ended in a draw${
                    gameover?.reason ? ` by ${gameover.reason}` : ""
                  }`}
            </div>

            <div className="flex gap-1">
              <ShareGameDialog game={game} />
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

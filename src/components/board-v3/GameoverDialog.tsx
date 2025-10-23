import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import HomeButton from "./HomeButton";
import ShareGameDialog from "./ShareGameDialog";
import { GameClient } from "@/game/engine-v2";
import { MatchV3 } from "@/lib/types";

export default function GameoverDialog({
  game,
  match,
}: {
  game: GameClient;
  match?: MatchV3;
}) {
  const [open, setOpen] = useState(false);

  const gameover = useMemo(() => {
    // If the match object from the database is available, use it to get the gameover state first.
    if (match?.status && match.winnerUserId && match.gameoverReason) {
      return {
        winner:
          match.status === "WIN"
            ? match.player0UserId === match.winnerUserId
              ? "RED"
              : "BLUE"
            : undefined,
        reason: match.gameoverReason,
      };
    }

    // Otherwise use the gameover from the game client.
    return game.gameover();
  }, [game.turn, game.moves, match]);

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

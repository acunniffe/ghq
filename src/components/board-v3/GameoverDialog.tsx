import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import HomeButton from "./HomeButton";
import ShareGameDialog from "./ShareGameDialog";
import { GameClient, gameoverReason, Player } from "@/game/engine-v2";
import { MatchV3, User } from "@/lib/types";
import Username from "../Username";
import { GameoverState } from "@/game/engine";

export default function GameoverDialog({
  game,
  match,
  gameover,
  users,
}: {
  game: GameClient;
  match?: MatchV3;
  gameover: GameoverState | undefined;
  users: User[];
}) {
  const [open, setOpen] = useState(false);

  const getUser = useCallback(
    (player: Player) => {
      const userId =
        player === "RED" ? match?.player0UserId : match?.player1UserId;
      const user = users.find((u) => u.id === userId);
      return user ? <Username user={user} /> : toTitleCase(player);
    },
    [users, match]
  );

  const redPlayer = useMemo(() => getUser("RED"), [getUser]);
  const bluePlayer = useMemo(() => getUser("BLUE"), [getUser]);

  useEffect(() => {
    setOpen(!!gameover);
  }, [gameover]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game ended</DialogTitle>
          <DialogDescription></DialogDescription>
          <div className="flex flex-col gap-4 items-center">
            <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-4">
              <div className="flex justify-center sm:justify-end w-full">
                <div className="bg-red-500/10 border border-red-500 rounded-lg px-2 py-1">
                  {redPlayer}
                </div>
              </div>
              <div className="text-gray-600 text-xs font-medium">vs.</div>
              <div className="flex justify-center sm:justify-start w-full">
                <div className="bg-blue-500/10 border border-blue-500 rounded-lg px-2 py-1">
                  {bluePlayer}
                </div>
              </div>
            </div>

            <div className="flex flex-col w-full items-center justify-center">
              <div className="font-bold text-gray-800">
                {gameover?.winner
                  ? `${toTitleCase(gameover.winner)} won!`
                  : "It's a draw!"}
              </div>
              <div className="text-xs text-gray-600">
                {gameoverReason(gameover)}
              </div>
            </div>

            <div className="flex gap-2">
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

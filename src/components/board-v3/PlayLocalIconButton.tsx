import { GameClient } from "@/game/engine-v2";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink, SearchCheck } from "lucide-react";

export default function PlayLocalIconButton({ game }: { game: GameClient }) {
  const fen = game.fen();
  function handlePlayLocal() {
    const url = new URL(window.location.toString());
    url.pathname = "/local";
    url.searchParams.set("fen", fen);
    window.open(url.toString(), "_blank");
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="outline" onClick={handlePlayLocal}>
            <SearchCheck />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-1">
            Play from here
            <ExternalLink className="h-3 w-3" />
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

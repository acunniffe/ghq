"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Label } from "@/components/ui/label";
import { GameClient } from "@/game/engine-v2";
import { Textarea } from "../ui/textarea";

export default function ShareGameDialog({ game }: { game: GameClient }) {
  const fen = game.fen();
  const url = new URL(window.location.toString());
  url.pathname = "/local";
  url.searchParams.set("fen", fen);
  const learnUrl = url.toString();

  function handlePlayBot() {
    const url = new URL(window.location.toString());
    url.pathname = "/bot";
    url.searchParams.set("fen", fen);
    window.open(url.toString(), "_blank");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="text-sm">
          <Share /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>Save the current game</DialogDescription>
          <div className="flex flex-col gap-2">
            <div>
              <Label htmlFor="jfen">FEN</Label>
              <Input
                readOnly
                spellCheck={false}
                className="font-mono"
                type="jfen"
                id="jfen"
                placeholder=""
                value={game.fen()}
              />
            </div>
            <div>
              <Label htmlFor="jfen">Analysis</Label>
              <Input
                readOnly
                spellCheck={false}
                className="font-mono"
                type="url"
                id="fen-url"
                placeholder=""
                value={learnUrl}
              />
            </div>
            <div>
              <Label htmlFor="url">URL</Label>
              <Input
                readOnly
                spellCheck={false}
                className="font-mono"
                type="url"
                id="url"
                placeholder=""
                value={
                  typeof window !== "undefined"
                    ? window.location.toString()
                    : ""
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pgn">PGN</Label>
              <Textarea
                readOnly
                rows={3}
                spellCheck={false}
                className="font-mono resize-none w-full text-sm"
                id="pgn"
                placeholder=""
                value={game.pgn()}
              />
            </div>
            <div>
              <Button onClick={handlePlayBot}>
                <Swords /> Play bot from this position
              </Button>
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

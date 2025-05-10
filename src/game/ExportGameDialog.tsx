"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GHQState } from "./engine";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Label } from "@/components/ui/label";
import { boardToFEN } from "./notation";
import { Ctx } from "boardgame.io";

export default function ShareGameDialog({ G, ctx }: { G: GHQState; ctx: Ctx }) {
  const url = new URL(window.location.toString());
  url.pathname = "/learn";
  url.searchParams.set(
    "jfen",
    boardToFEN({
      board: G.board,
      redReserve: G.redReserve,
      blueReserve: G.blueReserve,
      thisTurnMoves: G.thisTurnMoves,
      currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
    })
  );
  const learnUrl = url.toString();

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
                value={boardToFEN({
                  board: G.board,
                  redReserve: G.redReserve,
                  blueReserve: G.blueReserve,
                  thisTurnMoves: G.thisTurnMoves,
                  currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
                })}
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
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

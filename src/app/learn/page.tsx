"use client";

import { Client } from "boardgame.io/react";
import { useEffect, useState } from "react";
import { GHQBoard } from "@/game/board";
import ReplayCapability from "@/game/ReplayCapability";
import { BoardType, getBoardInfo, newTutorialGHQGame } from "@/game/tutorial";
import { useRouter, useSearchParams } from "next/navigation";
import { boards } from "@/game/tutorial";
import Header from "@/components/Header";
import { Import, ImportIcon, Loader2 } from "lucide-react";
import { useBoardArrow } from "@/game/BoardArrowProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardToFEN } from "@/game/notation";
import { defaultBoard, defaultReserveFleet } from "@/game/engine";
import { Button } from "@/components/ui/button";

export default function Page() {
  const searchParams = useSearchParams();
  const [client, setClient] = useState<any | null>(null);
  const [App, setApp] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { setBoardArrows } = useBoardArrow();

  useEffect(() => {
    const boardType = searchParams.get("boardType") as BoardType | undefined;
    const jfen = searchParams.get("jfen") as string | undefined;

    const boardInfo = getBoardInfo(boardType, jfen);
    if (!boardInfo) {
      setApp(null);
      setLoading(false);
      return;
    }

    // Wait a second to set the board arrow so that the board has time to render
    setTimeout(() => {
      setBoardArrows(boardInfo.boardArrows);
    }, 500);

    const DynamicApp = Client({
      game: newTutorialGHQGame({ boardState: boardInfo.boardState }),
      board: GHQBoard,
    });
    setApp(() => {
      setLoading(false);
      return DynamicApp;
    });
  }, [searchParams]);

  if (!App) {
    return (
      <div className="p-2 flex flex-col gap-4 lg:px-48">
        <Header />

        {loading && (
          <div className="flex gap-1">
            <Loader2 className="animate-spin w-6 h-6" /> Loading...
          </div>
        )}
        {!loading && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 border rounded p-4 bg-slate-50">
              <div className="text-2xl">Basics</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(boards)
                  .filter(([, boardInfo]) => !boardInfo.isPuzzle)
                  .map(([boardType]) => (
                    <a
                      key={boardType}
                      href={`/learn?boardType=${boardType}`}
                      className="py-3 px-4 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md min-w-96"
                    >
                      <div className="tracking-tight text-gray-900">
                        {boardType}
                      </div>
                    </a>
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border rounded p-4 bg-slate-50">
              <div className="text-2xl">Puzzles</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(boards)
                  .filter(([, boardInfo]) => boardInfo.isPuzzle)
                  .map(([boardType]) => (
                    <a
                      key={boardType}
                      href={`/learn?boardType=${boardType}`}
                      className="py-3 px-4 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md min-w-96"
                    >
                      <div className="tracking-tight text-gray-900">
                        {boardType}
                      </div>
                    </a>
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border rounded p-4 bg-slate-50">
              <div className="text-2xl">Analysis</div>
              <div className="flex flex-wrap gap-1">
                <ImportGame />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {client && <ReplayCapability client={client} />}
      {App && <App ref={(ref: any) => setClient(ref?.client)} />}
    </div>
  );
}

function ImportGame() {
  const router = useRouter();
  const [jfen, setJfen] = useState(
    boardToFEN({
      board: defaultBoard,
      redReserve: defaultReserveFleet,
      blueReserve: defaultReserveFleet,
    })
  );

  function onClick() {
    router.push(`/learn?jfen=${jfen}`);
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="jfen">JFEN</Label>
      <Input
        spellCheck={false}
        className="font-mono bg-white w-96"
        type="jfen"
        id="jfen"
        placeholder=""
        onChange={(e) => setJfen(e.target.value)}
        value={jfen}
      />

      <div>
        <Button onClick={onClick}>
          <ImportIcon /> Import
        </Button>
      </div>
    </div>
  );
}

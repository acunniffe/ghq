"use client";

import { useEffect, useState } from "react";
import { BoardType, getBoardInfo } from "@/game/tutorial";
import { useRouter, useSearchParams } from "next/navigation";
import { boards } from "@/game/tutorial";
import Header from "@/components/Header";
import { ImportIcon, Loader2, Pencil } from "lucide-react";
import { useBoardArrow } from "@/game/BoardArrowProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardToFEN } from "@/game/notation";
import { defaultBoard, defaultReserveFleet } from "@/game/engine";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import LearnBasics from "./LearnBasics";
import { GHQBoardV3 } from "@/components/board-v3/boardv3";

export default function Page() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [boardFen, setBoardFen] = useState<string | undefined>(undefined);
  const { setBoardArrows } = useBoardArrow();

  useEffect(() => {
    const boardType = searchParams.get("boardType") as BoardType | undefined;
    const fen = searchParams.get("jfen") as string | undefined;

    if (!boardType && !fen) {
      setLoading(false);
      setBoardFen(undefined);
      return;
    }

    const boardInfo = getBoardInfo(boardType, fen);
    if (!boardInfo) {
      setLoading(false);
      return;
    }

    // Wait a second to set the board arrow so that the board has time to render
    setTimeout(() => {
      setBoardArrows(boardInfo.boardArrows);
    }, 2000);
    setBoardFen(boardInfo.fen);
  }, [searchParams]);

  if (!boardFen) {
    return (
      <div className="p-2 flex flex-col gap-4 lg:px-48 mb-20">
        <Header />
        {loading && (
          <div className="flex gap-1">
            <Loader2 className="animate-spin w-6 h-6" /> Loading...
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-8">
            <Section heading="Basics">
              <LearnBasics />
            </Section>

            <Section heading="Learn capturing">
              <div className="flex flex-wrap gap-1">
                {Object.entries(boards)
                  .filter(([, boardInfo]) => boardInfo.category === "capturing")
                  .map(([boardType]) => (
                    <Link
                      key={boardType}
                      href={`/learn?boardType=${boardType}`}
                      className="py-3 px-4 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md min-w-48 w-80"
                    >
                      <div className="tracking-tight text-gray-900">
                        {boardType}
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>

            <Section heading="Puzzles">
              <div className="flex flex-wrap gap-1">
                {Object.entries(boards)
                  .filter(([, boardInfo]) => boardInfo.category === "puzzles")
                  .map(([boardType]) => (
                    <Link
                      key={boardType}
                      href={`/learn?boardType=${boardType}`}
                      className="py-3 px-4 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md min-w-48 w-80"
                    >
                      <div className="tracking-tight text-gray-900">
                        {boardType}
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>

            <Section heading="Endgames">
              <div className="flex flex-wrap gap-1">
                {Object.entries(boards)
                  .filter(([, boardInfo]) => boardInfo.category === "endgames")
                  .map(([boardType]) => (
                    <Link
                      key={boardType}
                      href={`/learn?boardType=${boardType}`}
                      className="py-3 px-4 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md min-w-48 w-80"
                    >
                      <div className="tracking-tight text-gray-900">
                        {boardType}
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>

            <Section heading="Analysis">
              <ImportGame />
              <Editor />
            </Section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <GHQBoardV3 isPassAndPlayMode={true} fen={boardFen} />
    </div>
  );
}

function ImportGame() {
  const router = useRouter();
  const [fen, setFen] = useState(
    boardToFEN({
      board: defaultBoard,
      redReserve: defaultReserveFleet,
      blueReserve: defaultReserveFleet,
    })
  );

  function onClick() {
    router.push(`/learn?jfen=${fen}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="fen">FEN</Label>
      <Input
        spellCheck={false}
        className="font-mono bg-white w-96"
        type="fen"
        id="fen"
        placeholder=""
        onChange={(e) => setFen(e.target.value)}
        value={fen}
      />

      <div>
        <Button onClick={onClick}>
          <ImportIcon /> Import
        </Button>
      </div>
    </div>
  );
}

function Editor() {
  const router = useRouter();

  function onClick() {
    router.push(`/editor`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={onClick}>
        <Pencil /> Board Editor
      </Button>
    </div>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-lg font-bold">{heading}</div>
      {children}
    </div>
  );
}

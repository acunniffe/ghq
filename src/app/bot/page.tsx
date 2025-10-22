"use client";

import { GHQBoardV3 } from "@/components/board-v3/boardv3";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const searchParams = useSearchParams();
  const fen = useMemo(
    () => searchParams.get("fen") ?? undefined,
    [searchParams]
  );

  return (
    <div>
      <GHQBoardV3 fen={fen} bot={true} playerId="0" />
    </div>
  );
}

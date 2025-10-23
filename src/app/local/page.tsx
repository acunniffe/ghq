"use client";

import { GHQBoardV3 } from "@/components/board-v3/boardv3";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function Page() {
  const searchParams = useSearchParams();
  const fen = useMemo(
    () => searchParams.get("fen") ?? undefined,
    [searchParams]
  );
  return (
    <div>
      <GHQBoardV3 isPassAndPlayMode={true} fen={fen} />
    </div>
  );
}

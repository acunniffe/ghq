"use client";

import { GHQBoardV3 } from "@/components/board-v3/boardv3";

export default function Page() {
  return (
    <div>
      <GHQBoardV3 isPassAndPlayMode={true} />
    </div>
  );
}

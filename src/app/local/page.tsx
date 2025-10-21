"use client";

import { GHQBoardV3 } from "@/components/board-v3/boardv3";
import { useEngine } from "@/game/engine-v2";

export default function Page() {
  const { engine } = useEngine();

  return (
    <div>
      <GHQBoardV3 engine={engine} isTutorial={false} />
    </div>
  );
}

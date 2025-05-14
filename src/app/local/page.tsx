"use client";

import { Client } from "boardgame.io/react";
import { useEffect, useState } from "react";
import ReplayCapability from "@/game/ReplayCapability";
import { GHQBoardV2 } from "@/components/board/boardv2";
import { newGHQGameV2, useEngine } from "@/game/engine-v2";
import { Loader2 } from "lucide-react";

export default function Page() {
  const [client, setClient] = useState<any | null>(null);
  const [App, setApp] = useState<any | null>(null);
  const { engine } = useEngine();

  useEffect(() => {
    if (!engine) {
      return;
    }

    const AppComponent = Client({
      game: newGHQGameV2({ engine, type: "local" }),
      board: GHQBoardV2,
    });
    setApp(() => AppComponent);
  }, [engine]);

  if (!App) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {client && <ReplayCapability client={client} />}
      <App ref={(ref: any) => setClient(ref?.client)} />
    </div>
  );
}

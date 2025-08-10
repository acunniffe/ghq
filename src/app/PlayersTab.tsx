"use client";

import { useState } from "react";
import Leaderboard from "./Leaderboard";
import Players from "./Players";
import { cn } from "@/lib/utils";
import { useMatchmaking } from "@/components/MatchmakingProvider";
import ThisMonthPlayers from "./ThisMonthPlayers";

export default function PlayersTab() {
  const [tab, setTab] = useState<"leaderboard" | "players" | "thisMonth">(
    "thisMonth"
  );
  const { usersOnline } = useMatchmaking();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 justify-center text-gray-800 text-sm">
        <button
          onClick={() => setTab("thisMonth")}
          className={cn(
            tab === "thisMonth" && "font-bold underline underline-offset-2",
            "rounded px-2 py-1 hover:bg-white/70"
          )}
        >
          Current Month
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={cn(
            tab === "leaderboard" && "font-bold",
            "rounded px-2 py-1 hover:bg-white/70"
          )}
        >
          Overall Rating
        </button>
        <button
          onClick={() => setTab("players")}
          className={cn(
            "flex flex-row gap-1 items-center",
            tab === "players" && "font-bold",
            "rounded px-2 py-1 hover:bg-white/70"
          )}
        >
          Online
          <span className="text-sm">
            {usersOnline?.users.length && `(${usersOnline.users.length})`}
          </span>
        </button>
      </div>
      {tab === "thisMonth" && <ThisMonthPlayers />}
      {tab === "leaderboard" && <Leaderboard />}
      {tab === "players" && <Players usersOnline={usersOnline} />}
    </div>
  );
}

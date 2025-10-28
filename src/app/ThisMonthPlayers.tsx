"use client";

import { ghqFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { StatusIndicator } from "@/components/StatusIndicator";
import { useMatchmaking } from "@/components/MatchmakingProvider";
import { OnlineUser, UserBadge } from "@/lib/types";
import Username from "@/components/Username";

interface MatchSummary {
  userId: string;
  username: string;
  badge: UserBadge;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  status?: OnlineUser["status"];
}

export default function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [rawUsers, setRawUsers] = useState<MatchSummary[]>([]);
  const [users, setUsers] = useState<MatchSummary[]>([]);
  const { usersOnline: usersOnlineFromMatchmaking } = useMatchmaking();

  useEffect(() => {
    setLoading(true);

    ghqFetch<{ summary: MatchSummary[] }>({
      url: "/api/match-summary",
      getToken: async () => "", // public api
      method: "GET",
    })
      .then((data) => {
        setRawUsers(data.summary ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const userStatusLookup = new Map<string, OnlineUser["status"]>();
    for (const user of usersOnlineFromMatchmaking?.users ?? []) {
      userStatusLookup.set(user.id, user.status);
    }

    const users: MatchSummary[] = rawUsers.map((user) => {
      return {
        ...user,
        status: userStatusLookup.get(user.userId) ?? "offline",
      };
    });

    setUsers(users);
  }, [usersOnlineFromMatchmaking, rawUsers]);

  return (
    <div className="flex flex-col gap-2 w-full">
      {loading && (
        <div className="flex flex-col gap-0.5">
          <div className="py-2 px-3 bg-white/50 animate-pulse rounded-lg h-8"></div>
          <div className="py-2 px-3 bg-white/50 animate-pulse rounded-lg h-8"></div>
          <div className="py-2 px-3 bg-white/50 animate-pulse rounded-lg h-8"></div>
        </div>
      )}

      <div className="flex flex-col">
        {users.map((user: MatchSummary) => (
          <div
            key={user.userId}
            className="rounded grid grid-cols-10 gap-4 items-center"
          >
            <div className="col-span-7 md:col-span-8 flex flex-row gap-2 items-center">
              <StatusIndicator status={user.status ?? "offline"} />
              <Username
                user={{
                  id: user.userId,
                  username: user.username,
                  elo: user.elo,
                  badge: user.badge,
                }}
              />
            </div>
            <div className="col-span-3 md:col-span-2 grid grid-cols-5 gap-1 items-center text-right">
              <span className="text-green-700 text-center">{user.wins}</span>
              <span className="text-gray-500 text-center">|</span>
              <span className="text-red-700 text-center">{user.losses}</span>
              <span className="text-gray-500 text-center">|</span>
              <span className="text-gray-700 text-center">{user.draws}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

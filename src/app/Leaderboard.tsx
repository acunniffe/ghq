"use client";

import { API_URL } from "./live/config";
import { ghqFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { StatusIndicator } from "@/components/StatusIndicator";
import { useMatchmaking } from "@/components/MatchmakingProvider";
import { OnlineUser, User } from "@/lib/types";
import Username from "@/components/Username";

export default function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [rawUsers, setRawUsers] = useState<User[]>([]);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const { usersOnline: usersOnlineFromMatchmaking } = useMatchmaking();

  useEffect(() => {
    setLoading(true);

    ghqFetch<{ users: User[] }>({
      url: `${API_URL}/leaderboard`,
      getToken: async () => "", // public api
      method: "GET",
    })
      .then((data) => {
        setRawUsers(data.users ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const userStatusLookup = new Map<string, OnlineUser["status"]>();
    for (const user of usersOnlineFromMatchmaking?.users ?? []) {
      userStatusLookup.set(user.id, user.status);
    }

    const users: OnlineUser[] = rawUsers.map((user) => {
      return {
        ...user,
        status: userStatusLookup.get(user.id) ?? "offline",
      };
    });

    setUsers(users);
  }, [usersOnlineFromMatchmaking, rawUsers]);

  return (
    <div className="flex flex-col gap-2 w-full">
      {loading && (
        <div className="flex flex-col gap-2">
          <div className="py-2 px-3 bg-gray-300 animate-pulse border border-gray-200 rounded-lg h-8"></div>
          <div className="py-2 px-3 bg-gray-300 animate-pulse border border-gray-200 rounded-lg h-8"></div>
          <div className="py-2 px-3 bg-gray-300 animate-pulse border border-gray-200 rounded-lg h-8"></div>
        </div>
      )}

      <div className="flex flex-col">
        {users.map((user: OnlineUser) => (
          <div key={user.id} className="rounded flex justify-between">
            <div className="flex flex-row gap-2 items-center">
              <StatusIndicator status={user.status} />
              <Username
                user={{
                  id: user.id,
                  username: user.username,
                  elo: user.elo,
                  badge: user.badge,
                }}
              />
            </div>
            <div>{user.elo}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

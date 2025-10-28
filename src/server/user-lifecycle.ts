import { OnlineUser, UsersOnline } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  getUserQueueStatus,
  inGameUsers,
  listUserIdsInQueues,
} from "./matchmaking";

const ONLINE_USER_STALE_MS = 10_000;

const usersOnline: Map<string, number> = new Map();

let usersOnlineResponse: UsersOnline = {
  users: [],
};

export function getUsersOnlineResponse(): UsersOnline {
  return usersOnlineResponse;
}

export async function userLifecycle({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  // Remove stale users from the online users list
  for (const [userId, lastActive] of usersOnline.entries()) {
    if (lastActive < Date.now() - ONLINE_USER_STALE_MS) {
      console.log(`Removing stale user from online users`, userId);
      usersOnline.delete(userId);
    }
  }

  const res: UsersOnline = {
    users: [],
  };

  const allUserIds = listUserIdsInQueues();
  for (const userId of usersOnline.keys()) {
    allUserIds.push(userId);
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, elo, gamesThisMonth, badge")
    .in("id", allUserIds);

  if (error) {
    console.log({
      message: "Error fetching users",
      error,
    });
    return;
  }

  for (const user of users) {
    let status: OnlineUser["status"] = "online";
    const activeQueue = getUserQueueStatus(user.id);
    if (activeQueue) {
      status = activeQueue;
    } else if (isActiveInGame(user.id)) {
      status = "in game";
    }

    res.users.push({
      id: user.id,
      username: user.username,
      elo: user.elo,
      gamesThisMonth: user.gamesThisMonth,
      badge: user.badge,
      status,
    });
  }

  // Sort users with "online" status at the top
  res.users.sort((a, b) => {
    if (a.status === "online" && b.status !== "online") {
      return -1;
    }
    if (a.status !== "online" && b.status === "online") {
      return 1;
    }
    return 0;
  });

  usersOnlineResponse = res;
}

export function addUserToOnlineUsers(userId: string) {
  usersOnline.set(userId, Date.now());
}

function isActiveInGame(userId: string): boolean {
  const lastActive = inGameUsers.get(userId);
  if (!lastActive) {
    return false;
  }
  return lastActive > Date.now() - 10_000;
}

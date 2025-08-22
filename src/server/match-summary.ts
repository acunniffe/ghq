import { SupabaseClient } from "@supabase/supabase-js";
import { UserBadge } from "@/lib/types";

interface MatchStats {
  wins: number;
  losses: number;
  draws: number;
}

interface MatchSummary {
  userId: string;
  username: string;
  badge: UserBadge;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export async function getMatchSummary(
  supabase: SupabaseClient
): Promise<{ summary: MatchSummary[] }> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: matches, error } = await supabase
    .from("matches")
    .select("player0_id, player1_id, winner_id, status")
    .gte("created_at", firstDayOfMonth.toISOString())
    .lte("created_at", now.toISOString());

  if (error) {
    console.log({
      message: "Error fetching matches for summary",
      error,
    });
    throw new Error("Error fetching matches");
  }

  if (!matches) {
    return { summary: [] };
  }

  const stats = new Map<string, MatchStats>();

  for (const match of matches) {
    const player0 = match.player0_id;
    const player1 = match.player1_id;

    if (!stats.has(player0)) {
      stats.set(player0, { wins: 0, losses: 0, draws: 0 });
    }
    if (!stats.has(player1)) {
      stats.set(player1, { wins: 0, losses: 0, draws: 0 });
    }

    const player0Stats = stats.get(player0)!;
    const player1Stats = stats.get(player1)!;

    if (match.status === "DRAW") {
      player0Stats.draws++;
      player1Stats.draws++;
    } else if (match.winner_id === player0) {
      player0Stats.wins++;
      player1Stats.losses++;
    } else if (match.winner_id === player1) {
      player1Stats.wins++;
      player0Stats.losses++;
    }
  }

  const userIds = Array.from(stats.keys());
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, username, elo, gamesThisMonth, badge")
    .in("id", userIds);

  if (usersError) {
    console.log({
      message: "Error fetching users for summary",
      usersError,
    });
    throw new Error("Error fetching users");
  }

  if (!users) {
    return { summary: [] };
  }

  const userMap = new Map(
    users.map((user) => [
      user.id,
      {
        username: user.username ?? "Anonymous",
        badge: user.badge,
      },
    ])
  );
  const eloMap = new Map(users.map((user) => [user.id, user.elo]));

  const summary = Array.from(stats.entries()).map(([userId, stats]) => ({
    userId,
    username: userMap.get(userId)?.username,
    elo: eloMap.get(userId),
    badge: userMap.get(userId)?.badge,
    ...stats,
  }));

  summary.sort((a, b) => b.wins - a.wins);

  const top10 = summary.slice(0, 15);

  return { summary: top10 };
}

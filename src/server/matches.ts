import { MatchModel } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

export async function listMatches({
  supabase,
  userId,
  isCorrespondence,
}: {
  supabase: SupabaseClient;
  userId?: string;
  isCorrespondence?: boolean;
}): Promise<MatchModel[]> {
  let query = supabase
    .from("matches")
    .select(
      "id, created_at, player0_id, player1_id, player0_elo, player1_elo, winner_id, status, current_turn_player_id, rated"
    );

  if (userId) {
    query = query.or(`player0_id.eq.${userId},player1_id.eq.${userId}`);
  }

  if (isCorrespondence) {
    query = query.eq("is_correspondence", true);
  }

  query = query.order("created_at", { ascending: false }).limit(100);

  const { data: matchesData, error: matchesError } = await query;

  if (matchesError) {
    console.log({
      message: "Error fetching matches",
      matchesError,
    });
    return [];
  }

  const userIds = matchesData.flatMap((match) => [
    match.player0_id,
    match.player1_id,
  ]);

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username")
    .in("id", userIds);

  if (error) {
    console.log({
      message: "Error fetching users for matches",
      error,
    });
    return [];
  }

  const matches: MatchModel[] = [];

  if (users) {
    const userMap = new Map(
      users.map((user) => [user.id, user.username ?? "Anonymous"])
    );

    for (const match of matchesData) {
      matches.push({
        id: match.id,
        player1: userMap.get(match.player0_id),
        player2: userMap.get(match.player1_id),
        winner: userMap.get(match.winner_id) ?? null,
        player1Elo: match.player0_elo,
        player2Elo: match.player1_elo,
        status: match.status,
        createdAt: match.created_at,
        isYourTurn: isCorrespondence
          ? match.current_turn_player_id === userId
          : undefined,
        rated: match.rated,
      });
    }
  }

  return matches;
}

export async function getActivePlayersInLast30Days({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<string[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select("player0_id, player1_id")
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (matchesError) {
    console.log({
      message: "Error fetching matches for active players",
      matchesError,
    });
    return [];
  }

  const uniqueUserIds = new Set<string>();
  for (const match of matchesData) {
    uniqueUserIds.add(match.player0_id);
    uniqueUserIds.add(match.player1_id);
  }

  return Array.from(uniqueUserIds);
}

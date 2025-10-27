import { createClient } from "@supabase/supabase-js";
import { ActiveMatch, MatchV3, User } from "@/lib/types";
import {
  matchToSupabaseMatch,
  SupabaseMatch,
  supabaseMatchToMatchV3,
} from "./supabase";

const supabase = createClient(
  "https://wjucmtrnmjcaatbtktxo.supabase.co",
  process.env.SUPABASE_SECRET_KEY!
);

export async function createMatchV3(match: MatchV3): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .insert(matchToSupabaseMatch(match));
  if (error) {
    throw error;
  }
}

export async function fetchMatchV3(id: string): Promise<MatchV3 | undefined> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();
  if (error?.code === "PGRST116") {
    return undefined;
  }
  if (error) {
    throw error;
  }
  return supabaseMatchToMatchV3(data);
}

export type MatchPGNUpdater = (match: SupabaseMatch) => SupabaseMatch;

export async function updateMatchPGN(
  id: string,
  pgnUpdater: MatchPGNUpdater
): Promise<MatchV3> {
  const { data: match, error: fetchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (!match) {
    throw new Error(`Match with id ${id} not found`);
  }

  const updatedMatch = pgnUpdater(match);

  const { data: updateResult, error: updateError } = await supabase
    .from("matches")
    .update(updatedMatch)
    .eq("id", id)
    .eq("pgn", match.pgn) // IMPORTANT: ensure no other process has modified the PGN since we fetched it
    .select();

  if (updateError) {
    throw updateError;
  }

  if (!updateResult || updateResult.length === 0) {
    throw new Error(
      `Failed to update match ${id}: PGN was modified by another process`
    );
  }

  return supabaseMatchToMatchV3(updatedMatch);
}

interface CreateActiveMatchesOptions {
  matchId: string;
  player0UserId: string;
  player1UserId: string;
  player0Credentials: string;
  player1Credentials: string;
  isCorrespondence: boolean;
}

export async function createActiveMatches({
  matchId,
  player0UserId,
  player1UserId,
  player0Credentials,
  player1Credentials,
  isCorrespondence,
}: CreateActiveMatchesOptions): Promise<void> {
  const { error } = await supabase.from("active_user_matches").insert([
    {
      user_id: player0UserId,
      match_id: matchId,
      player_id: "0",
      credentials: player0Credentials,
      is_correspondence: isCorrespondence,
    },
    {
      user_id: player1UserId,
      match_id: matchId,
      player_id: "1",
      credentials: player1Credentials,
      is_correspondence: isCorrespondence,
    },
  ]);
  if (error) throw error;
}

export async function getActiveMatch(
  userId: string,
  matchId: string
): Promise<ActiveMatch | undefined> {
  const { data, error } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .single();
  if (error) {
    if (error.code === "PGRST116") {
      // not found is expected if this user isn't actively playing this match
      return undefined;
    }
    console.log({
      message: "Error getting active match",
      userId,
      matchId,
      error,
    });
    return undefined;
  }

  return {
    id: data?.match_id || "",
    playerId: data?.player_id,
    credentials: data?.credentials,
  };
}

export async function deleteActiveMatches(matchId: string) {
  const { error } = await supabase
    .from("active_user_matches")
    .delete()
    .eq("match_id", matchId);
  if (error) {
    console.log({
      message: "Error deleting active_user_matches",
      matchId,
      error,
    });
  }
}

export function onMatchChange(callback: (newMatch: MatchV3) => void) {
  console.log("Listening for match changes!");
  supabase
    .channel("schema-db-changes")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
      },
      (payload) => {
        callback(supabaseMatchToMatchV3(payload.new as SupabaseMatch));
      }
    )
    .subscribe();
}

export async function updatePlayerElo(
  player: User,
  elo: number
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({
      elo,
      gamesThisMonth: player.gamesThisMonth || 0,
      badge: player.badge || null,
    })
    .eq("id", player.id);
  if (error) {
    console.log({
      message: "Error updating player elo",
      playerId: player.id,
      elo,
      error,
    });
  }
  return;
}

export async function listInProgressLiveMatches(): Promise<MatchV3[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .is("status", null)
    .eq("is_correspondence", false);
  if (error) {
    throw error;
  }
  return data.map(supabaseMatchToMatchV3);
}

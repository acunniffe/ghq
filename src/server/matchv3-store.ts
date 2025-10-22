import { createClient } from "@supabase/supabase-js";
import { ActiveMatch, MatchV3 } from "@/lib/types";
import { matchToSupabaseMatch, supabaseMatchToMatchV3 } from "./supabase";

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
  if (error) {
    throw error;
  }
  return supabaseMatchToMatchV3(data);
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

export async function getActiveMatchForUser(
  userId: string
): Promise<ActiveMatch | undefined> {
  const { data, error } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .eq("is_correspondence", false) // distinguish between live and correspondence, correspondence allows multiple simultaneous games
    .single();
  if (error) return undefined;

  return {
    id: data?.match_id || "",
    playerId: data?.player_id,
    credentials: data?.credentials,
  };
}

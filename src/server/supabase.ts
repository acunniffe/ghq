import { ActiveMatch, MatchV3 } from "@/lib/types";

export interface SupabaseMatch {
  id: string;
  created_at: Date;
  player0_id: string;
  player1_id: string;
  player0_elo: number;
  player1_elo: number;
  winner_id: string | null;
  status: string | null;
  is_correspondence: boolean | null;
  current_turn_player_id: string | null;
  rated: boolean;

  // TODO(tyler): add these to the sql
  player_0_credentials_hash: string | null;
  player_1_credentials_hash: string | null;
  time_control_name: string | null;
  time_control_allowed_time: number | null;
  time_control_bonus: number | null;
  time_control_variant: string | null;
  starting_fen: string | null;
  pgn: string | null;
}

export interface SupabaseActiveUserMatch {
  user_id: string;
  created_at: Date;
  match_id: string;
  player_id: string;
  credentials: string;
  is_correspondence: boolean | null;
}

export function matchToSupabaseMatch(
  match: MatchV3
): Omit<
  SupabaseMatch,
  "created_at" | "winner_id" | "status" | "current_turn_player_id"
> {
  return {
    id: match.id,
    player0_id: match.player0UserId,
    player1_id: match.player1UserId,
    player0_elo: match.player0Elo,
    player1_elo: match.player1Elo,
    is_correspondence: match.isCorrespondence,
    rated: match.rated,
    player_0_credentials_hash: match.player0CredentialsHash,
    player_1_credentials_hash: match.player1CredentialsHash,
    time_control_name: match.timeControlName,
    time_control_allowed_time: match.timeControlAllowedTime,
    time_control_bonus: match.timeControlBonus,
    time_control_variant: match.timeControlVariant ?? null,
    starting_fen: match.startingFen ?? null,
    pgn: match.pgn,
  };
}

export function supabaseMatchToMatchV3(supabaseMatch: SupabaseMatch): MatchV3 {
  return {
    id: supabaseMatch.id,
    createdAt: new Date(supabaseMatch.created_at).toISOString(),
    player0UserId: supabaseMatch.player0_id,
    player0Elo: supabaseMatch.player0_elo,
    player0CredentialsHash: supabaseMatch.player_0_credentials_hash ?? "",
    player1UserId: supabaseMatch.player1_id,
    player1Elo: supabaseMatch.player1_elo,
    player1CredentialsHash: supabaseMatch.player_1_credentials_hash ?? "",
    rated: supabaseMatch.rated,
    isCorrespondence: supabaseMatch.is_correspondence ?? false,
    timeControlName: supabaseMatch.time_control_name ?? "",
    timeControlAllowedTime: supabaseMatch.time_control_allowed_time ?? 0,
    timeControlBonus: supabaseMatch.time_control_bonus ?? 0,
    timeControlVariant: supabaseMatch.time_control_variant ?? undefined,
    startingFen: supabaseMatch.starting_fen ?? undefined,
    pgn: supabaseMatch.pgn || "",
  };
}

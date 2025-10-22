import { ActiveMatch, MatchV3 } from "@/lib/types";

const matches: Record<string, MatchV3> = {};
const activeMatches: Record<string, ActiveMatch> = {};

export async function createMatchV3(match: MatchV3): Promise<void> {
  matches[match.id] = match;
}

export async function fetchMatchV3(id: string): Promise<MatchV3 | undefined> {
  return matches[id];
}

interface CreateActiveMatchesOptions {
  matchId: string;
  player0UserId: string;
  player1UserId: string;
  player0Credentials: string;
  player1Credentials: string;
}

export async function createActiveMatches({
  matchId,
  player0UserId,
  player1UserId,
  player0Credentials,
  player1Credentials,
}: CreateActiveMatchesOptions): Promise<void> {
  // TODO(tyler): use active_user_matches table to create active matches here and below
  activeMatches[player0UserId] = {
    id: matchId,
    playerId: "0",
    credentials: player0Credentials,
  };
  activeMatches[player1UserId] = {
    id: matchId,
    playerId: "1",
    credentials: player1Credentials,
  };
}

export async function getActiveMatchForUser(
  userId: string
): Promise<ActiveMatch | undefined> {
  return activeMatches[userId];
}

import { ActiveMatch, MatchV3 } from "@/lib/types";

const matches: Record<string, MatchV3> = {};
const activeMatches: Record<string, ActiveMatch> = {};

export async function createMatchV3(match: MatchV3): Promise<void> {
  matches[match.id] = match;
}

export async function fetchMatchV3(id: string): Promise<MatchV3 | undefined> {
  return matches[id];
}

export async function createActiveMatchesFromMatchV3(
  match: MatchV3
): Promise<void> {
  activeMatches[match.player0UserId] = {
    id: match.id,
    playerId: "0",
    credentials: match.player0Credentials,
  };
  activeMatches[match.player1UserId] = {
    id: match.id,
    playerId: "1",
    credentials: match.player1Credentials,
  };
}

export async function getActiveMatchForUser(
  userId: string
): Promise<ActiveMatch | undefined> {
  return activeMatches[userId];
}

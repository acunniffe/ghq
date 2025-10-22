export interface MatchModel {
  id: string;
  winner: string;
  player1: string;
  player1Elo: number;
  player2: string;
  player2Elo: number;
  status: string;
  createdAt: string;
  isYourTurn?: boolean;
  rated?: boolean;
}

export interface User {
  id: string;
  username: string;
  elo: number;
  gamesThisMonth?: number;
  badge?: UserBadge;
}

export type UserBadge =
  | "recruit"
  | "sergeant"
  | "lieutenant"
  | "captain"
  | "commander"
  | "tralfamadorian";

export interface OnlineUser extends User {
  status:
    | "in blitz queue"
    | "in rapid queue"
    | "in endgame queue (unrated)"
    | "in normandy queue (unrated)"
    | "in rapid queue (unrated)"
    | "online"
    | "offline"
    | "in game";
}

export interface UsersOnline {
  users: OnlineUser[];
}

const BADGE_THRESHOLDS: Record<UserBadge, number> = {
  recruit: 1,
  sergeant: 3,
  lieutenant: 5,
  captain: 10,
  commander: 20,
  tralfamadorian: 50,
};

export function gamesPlayedToBadge(gamesPlayed: number): UserBadge | undefined {
  if (gamesPlayed < BADGE_THRESHOLDS.recruit) return undefined;
  if (gamesPlayed >= BADGE_THRESHOLDS.tralfamadorian) return "tralfamadorian";
  if (gamesPlayed >= BADGE_THRESHOLDS.commander) return "commander";
  if (gamesPlayed >= BADGE_THRESHOLDS.captain) return "captain";
  if (gamesPlayed >= BADGE_THRESHOLDS.lieutenant) return "lieutenant";
  if (gamesPlayed >= BADGE_THRESHOLDS.sergeant) return "sergeant";
  return "recruit";
}

export function badgeToGamesPlayed(badge: UserBadge): number {
  return BADGE_THRESHOLDS[badge];
}

export interface MatchV3 {
  id: string;
  player0UserId: string;
  player0Credentials: string;
  player1UserId: string;
  player1Credentials: string;
  timeControlName: string;
  timeControlAllowedTime: number;
  timeControlBonus: number;
  timeControlVariant?: string;
  rated: boolean;
  isCorrespondence: boolean;
  startingFen?: string;
  pgn: string;
}

export interface MatchV3Info {
  match: MatchV3;
  playerInfo?: {
    playerId: "0" | "1";
    credentials: string;
  };
}

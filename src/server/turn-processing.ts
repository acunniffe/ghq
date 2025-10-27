import { SendTurnRequest } from "@/lib/api";
import { MatchV3 } from "@/lib/types";
import { Turn } from "@/game/engine-v2";
import { createHash } from "crypto";

export function hashCredentials(credentials: string): string {
  return createHash("sha256").update(credentials).digest("hex");
}
// export async function hashCredentials(credentials: string): Promise<string> {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(credentials);
//   const hashBuffer = await crypto.subtle.digest("SHA-256", data);
//   const hashArray = Array.from(new Uint8Array(hashBuffer));
//   const hashHex = hashArray
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
//   return hashHex;
// }

function isEven(turn: Turn): boolean {
  return turn.turn % 2 === 0;
}

function isOdd(turn: Turn): boolean {
  return turn.turn % 2 === 1;
}

export async function isTurnAuthorized(
  authenticatedUserId: string,
  turnReq: SendTurnRequest,
  match: MatchV3
): Promise<boolean> {
  const { turn, playerId, credentials } = turnReq;
  const requiredHashCredentials =
    playerId === "0"
      ? match.player0CredentialsHash
      : match.player1CredentialsHash;
  const requiredPlayerId =
    playerId === "0" ? match.player0UserId : match.player1UserId;

  const requiredTurnValidator = playerId === "0" ? isOdd : isEven;

  const isAuthorized =
    authenticatedUserId === requiredPlayerId &&
    hashCredentials(credentials) === requiredHashCredentials &&
    (requiredTurnValidator(turn) || turn.playerResigned === playerId);

  if (!isAuthorized) {
    console.log("Unauthorized turn", {
      authenticatedUserId,
      requiredPlayerId,
      hashCredentials: hashCredentials(credentials),
      requiredHashCredentials,
      turn,
      isTurnValidated: requiredTurnValidator(turn),
    });
  }

  return isAuthorized;
}

export function getMatchTimeControl(match: MatchV3) {
  if (match.timeControlAllowedTime && match.timeControlBonus) {
    return {
      time: match.timeControlAllowedTime,
      bonus: match.timeControlBonus,
      variant: match.timeControlVariant || undefined,
    };
  }
  return undefined;
}

export function getGameStartTimeMs(createdAt?: string) {
  return createdAt ? new Date(createdAt).getTime() : undefined;
}

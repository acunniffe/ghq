import { LogEntry } from "boardgame.io";
import { allowedMoveFromUci } from "./notation-uci";
import { AllowedMove } from "./engine";

export function historyToPGN(history: LogEntry[]) {
  return history
    .map((move) => move?.metadata?.uci)
    .filter(Boolean)
    .join(" ");
}

export function PGNToMoves(pgn: string): AllowedMove[] {
  return pgn.split(" ").map(allowedMoveFromUci);
}

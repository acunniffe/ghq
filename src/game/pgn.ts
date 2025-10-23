import { Turn } from "./engine-v2";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";

export function createPGN(turns: Turn[]): string {
  return turns
    .map((turn, i) => {
      if (turn.isResignation) {
        const outcome = i % 2 === 0 ? "0-1" : "1-0"; // 0 is red, 1 is blue
        return `${outcome} {[%sts resign]}`;
      }
      return `${turn.turn}. ${turn.moves
        .map((move) => allowedMoveToUci(move))
        .join(" ")} {[%emt ${turn.elapsedSecs}]}\n`;
    })
    .join("");
}

export function pgnToTurns(pgn: string): Turn[] {
  const lines = pgn
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");

  return lines.map((line, index) => {
    const commentMatch = line.match(/\{([^}]*)\}/);
    let elapsedSecs = 0;

    if (commentMatch) {
      const comment = commentMatch[1];

      const stsMatch = comment.match(/\[%sts\s+(\w+)\]/);
      if (stsMatch && stsMatch[1] === "resign") {
        return resignationTurn(index + 1);
      }

      const emtMatch = comment.match(/\[%emt\s+([\d.]+)\]/);
      if (emtMatch) {
        elapsedSecs = parseFloat(emtMatch[1]);
      }
    }

    const movesSection = line.split("{")[0].trim();
    const movesWithoutTurnNumber = movesSection.replace(/^\d+\.\s*/, "");
    const uciMoves = movesWithoutTurnNumber
      .split(/\s+/)
      .filter((m) => m !== "");

    const moves = uciMoves.map((uci) => allowedMoveFromUci(uci));

    return {
      turn: index + 1,
      moves,
      elapsedSecs,
    };
  });
}

export function resignationTurn(turn: number): Turn {
  return {
    turn,
    moves: [],
    elapsedSecs: 0,
    isResignation: true, // just needs isResignation true, the rest shouldn't matter
  };
}

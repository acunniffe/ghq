import { Player, Turn } from "./engine-v2";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";

export function createPGN(turns: Turn[]): string {
  return turns.map((turn) => turnToString(turn)).join("\n");
}

export function turnToString(turn: Turn): string {
  if (turn.status) {
    let outcome = "1/2-1/2";
    if (turn.winner === "BLUE") {
      outcome = "0-1";
    } else if (turn.winner === "RED") {
      outcome = "1-0";
    }
    return `${outcome} {[%sts ${turn.status}]}`;
  }
  return `${turn.turn}. ${turn.moves
    .map((move) => allowedMoveToUci(move))
    .join(" ")} {[%emt ${turn.elapsedSecs}]}`;
}

export function stringToTurn(string: string): Turn {
  const commentMatch = string.match(/\{([^}]*)\}/);
  let elapsedSecs = 0;

  if (commentMatch) {
    const comment = commentMatch[1];

    const stsMatch = comment.match(/\[%sts\s+([\w-]+)\]/);
    if (stsMatch) {
      const status = stsMatch[1] as
        | "resign"
        | "timeout"
        | "hq-capture"
        | "double-skip";
      const outcome = string.split("{")[0].trim();
      const turnNumberMatch = string.match(/^\d+/);
      const turnNumber = turnNumberMatch ? parseInt(turnNumberMatch[0]) : 1;
      return gameEndTurn(turnNumber, outcome, status);
    }

    const emtMatch = comment.match(/\[%emt\s+([\d.]+)\]/);
    if (emtMatch) {
      elapsedSecs = parseFloat(emtMatch[1]);
    }
  }

  const movesSection = string.split("{")[0].trim();
  const turnNumberMatch = movesSection.match(/^\d+/);
  const turnNumber = turnNumberMatch ? parseInt(turnNumberMatch[0]) : 1;
  const movesWithoutTurnNumber = movesSection.replace(/^\d+\.\s*/, "");
  const uciMoves = movesWithoutTurnNumber.split(/\s+/).filter((m) => m !== "");

  const moves = uciMoves.map((uci) => allowedMoveFromUci(uci));

  return {
    turn: turnNumber,
    moves,
    elapsedSecs,
  };
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

      const stsMatch = comment.match(/\[%sts\s+([\w-]+)\]/);
      if (stsMatch) {
        const status = stsMatch[1] as
          | "resign"
          | "timeout"
          | "hq-capture"
          | "double-skip";
        const outcome = line.split("{")[0].trim();
        return gameEndTurn(index + 1, outcome, status);
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

export function gameEndTurn(
  turn: number,
  outcome: string,
  status: "resign" | "timeout" | "hq-capture" | "double-skip"
): Turn {
  const baseTurn: Turn = {
    turn,
    moves: [],
    elapsedSecs: 0,
    status,
  };

  if (outcome === "1-0") {
    baseTurn.winner = "RED";
  } else if (outcome === "0-1") {
    baseTurn.winner = "BLUE";
  }

  return baseTurn;
}

export function resignationTurn(turn: number, playerResigned: Player): Turn {
  return {
    turn,
    moves: [],
    elapsedSecs: 0,
    status: "resign",
    winner: playerResigned === "RED" ? "BLUE" : "RED",
  };
}

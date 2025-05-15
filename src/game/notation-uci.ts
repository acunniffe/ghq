import { AllowedMove, Coordinate, ReserveFleet, Orientation } from "./engine";
import {
  CARDINAL_DIRECTIONS,
  charToPiece,
  degreesToCardinal,
  unitToSymbol,
} from "./notation";

function orientationToCardinal(orientation: Orientation): string {
  return degreesToCardinal(orientation);
}

function cardinalToOrientation(cardinal: string): Orientation | null {
  const index = CARDINAL_DIRECTIONS.indexOf(
    cardinal as (typeof CARDINAL_DIRECTIONS)[number]
  );
  return index === -1 ? null : ((index * 45) as Orientation);
}

function rowIndexToRank(index: number): number {
  if (index < 0 || index > 7) {
    throw new Error("Index out of bounds");
  }
  return 8 - index;
}

function colIndexToFile(index: number): string {
  if (index < 0 || index > 7) {
    throw new Error("Index out of bounds");
  }
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return files[index];
}

function coordinateToSquare([row, col]: [number, number]): string {
  const rank = rowIndexToRank(row);
  const file = colIndexToFile(col);

  return `${file}${rank}`;
}

function squareToCoordinate(square: string): Coordinate {
  const file = square[0].toLowerCase();
  const rank = parseInt(square[1]);
  if (file < "a" || file > "h" || rank < 1 || rank > 8) {
    throw new Error(`invalid square: ${square}`);
  }
  // Convert file (a-h) to y coordinate (0-7)
  const col = file.charCodeAt(0) - "a".charCodeAt(0);
  // Convert rank (1-8) to x coordinate (0-7)
  const row = 8 - rank;
  return [row, col];
}

export function allowedMoveToUci(move: AllowedMove): string {
  if (move.name === "Skip") {
    return "skip";
  }

  if (move.name === "Reinforce") {
    let result = "r";
    const [unitType, to, capturePreference] = move.args;
    if (unitType !== undefined) {
      result += unitToSymbol[unitType].toLowerCase();
    }
    if (to !== undefined) {
      result += coordinateToSquare(to);
    }
    if (capturePreference !== undefined) {
      result += "x" + coordinateToSquare(capturePreference);
    }
    return result;
  }

  if (move.name === "Move") {
    const [from, to, capturePreference] = move.args;
    let result = coordinateToSquare(from) + coordinateToSquare(to);
    if (capturePreference !== undefined) {
      result += "x" + coordinateToSquare(capturePreference);
    }
    return result;
  }

  if (move.name === "MoveAndOrient") {
    const [from, to, orientation] = move.args;
    let result = coordinateToSquare(from) + coordinateToSquare(to);
    if (orientation !== undefined) {
      result += orientationToCardinal(orientation);
    }
    return result;
  }

  if (move.name === "AutoCapture") {
    const [autoCaptureType, capturePreference] = move.args;
    let result = "s";
    if (autoCaptureType === "bombard") {
      if (!capturePreference) {
        throw new Error("capturePreference is required for auto-capture");
      }
      result += "b" + coordinateToSquare(capturePreference);
    } else if (autoCaptureType === "free") {
      if (!capturePreference) {
        throw new Error("capturePreference is required for auto-capture");
      }
      result += "f" + coordinateToSquare(capturePreference);
    }
    return result;
  }

  return "";
}

export function allowedMoveFromUci(uci: string): AllowedMove {
  if (!uci) {
    throw new Error("empty uci string");
  }

  if (uci === "skip") {
    return { name: "Skip", args: [] };
  }

  if (uci.startsWith("r")) {
    let parts = uci.slice(1);
    let unitType: keyof ReserveFleet | undefined;
    let to: Coordinate | undefined;
    let capturePreference: Coordinate | undefined;

    if (parts && /[a-zA-Z]/.test(parts[0])) {
      const symbol = parts[0].toUpperCase();
      const piece = charToPiece(symbol);
      if (!piece) {
        throw new Error(`invalid unit type: ${parts[0]}`);
      }
      unitType = piece.type as keyof ReserveFleet;
      parts = parts.slice(1);
    }

    if (parts.length >= 2) {
      try {
        to = squareToCoordinate(parts.slice(0, 2));
        parts = parts.slice(2);
      } catch (e) {
        throw new Error(`invalid to square: ${parts.slice(0, 2)}`);
      }
    }

    if (parts.startsWith("x") && parts.length >= 3) {
      try {
        capturePreference = squareToCoordinate(parts.slice(1, 3));
      } catch (e) {
        throw new Error(`invalid capture square: ${parts.slice(1, 3)}`);
      }
    }

    return {
      name: "Reinforce",
      args: [unitType!, to!, capturePreference],
    };
  }

  if (uci.startsWith("s")) {
    if (uci.length < 3) {
      throw new Error("invalid auto-capture move: too short");
    }

    if (uci[1] === "b" && uci.length >= 4) {
      try {
        const capturePreference = squareToCoordinate(uci.slice(2, 4));
        return {
          name: "AutoCapture",
          args: ["bombard", capturePreference],
        };
      } catch (e) {
        throw new Error(`invalid capture square: ${uci.slice(2, 4)}`);
      }
    } else if (uci[1] === "f" && uci.length >= 4) {
      try {
        const capturePreference = squareToCoordinate(uci.slice(2, 4));
        return {
          name: "AutoCapture",
          args: ["free", capturePreference],
        };
      } catch (e) {
        throw new Error(`invalid capture square: ${uci.slice(2, 4)}`);
      }
    } else {
      throw new Error(`invalid auto-capture type: ${uci[1]}`);
    }
  }

  if (uci.length >= 4) {
    try {
      const from = squareToCoordinate(uci.slice(0, 2));
      const to = squareToCoordinate(uci.slice(2, 4));
      let parts = uci.slice(4);

      if (parts.startsWith("x") && parts.length >= 3) {
        try {
          const capturePreference = squareToCoordinate(parts.slice(1, 3));
          return {
            name: "Move",
            args: [from, to, capturePreference],
          };
        } catch (e) {
          throw new Error(`invalid capture square: ${parts.slice(1, 3)}`);
        }
      }

      if (parts && /[↑↗→↘↓↙←↖]/.test(parts[0])) {
        const orientation = cardinalToOrientation(parts[0]);
        if (orientation === null) {
          throw new Error(`invalid orientation: ${parts[0]}`);
        }
        return {
          name: "MoveAndOrient",
          args: [from, to, orientation],
        };
      }

      return {
        name: "Move",
        args: [from, to],
      };
    } catch (e) {
      throw new Error(`invalid squares: ${uci.slice(0, 4)}`);
    }
  }

  throw new Error(`invalid uci: ${uci}`);
}

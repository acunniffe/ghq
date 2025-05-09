import {
  GHQState,
  NonNullSquare,
  Orientation,
  Player,
  ReserveFleet,
} from "./engine";

export function rowIndexToRank(index: number): number {
  if (index < 0 || index > 7) {
    throw new Error("Index out of bounds");
  }
  return 8 - index;
}

export function colIndexToFile(index: number): string {
  if (index < 0 || index > 7) {
    throw new Error("Index out of bounds");
  }
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return files[index];
}

export function coordinateToAlgebraic([x, y]: [number, number]): string {
  const rank = rowIndexToRank(x);
  const file = colIndexToFile(y);

  return `${file}${rank}`;
}

export const CARDINAL_DIRECTIONS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

export function degreesToCardinal(degrees: Orientation): string {
  if (degrees < 0 || degrees >= 360) {
    throw new Error("Degrees out of bounds");
  }

  const index = Math.round(degrees / 45) % 8;

  return CARDINAL_DIRECTIONS[index];
}

function cardinalToDegrees(cardinal: string): Orientation | undefined {
  const index = CARDINAL_DIRECTIONS.indexOf(cardinal);

  if (index === -1) {
    return;
  }

  return (index * 45) as Orientation;
}

export interface BoardState {
  isTutorial?: true;
  board: GHQState["board"];
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;
  currentPlayerTurn?: Player;
}

// Inspired by https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation
// It is subtly different from FEN notation due to different piece types and the inclusion of orientation.
export function boardToFEN({
  board,
  redReserve,
  blueReserve,
  currentPlayerTurn,
}: BoardState): string {
  let fen = "";

  for (let i = 0; i < 8; i++) {
    let empty = 0;
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece === null) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += pieceToString(piece);
      }
    }
    if (empty > 0) {
      fen += empty;
    }
    if (i < 7) {
      fen += "/";
    }
  }

  fen += " ";

  fen +=
    Object.entries(redReserve)
      .map(([unit, count]) => unitToSymbol[unit].repeat(count))
      .join("") || "-";

  fen += " ";

  fen +=
    Object.entries(blueReserve)
      .map(([unit, count]) => unitToSymbol[unit].toLowerCase().repeat(count))
      .join("") || "-";

  fen += " ";

  fen += (currentPlayerTurn ?? "RED") === "RED" ? "r" : "b";

  return fen;
}

export function FENtoBoardState(fen: string): BoardState {
  const board: GHQState["board"] = [
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
  ];

  const redReserve: ReserveFleet = {
    INFANTRY: 0,
    ARMORED_INFANTRY: 0,
    AIRBORNE_INFANTRY: 0,
    ARTILLERY: 0,
    ARMORED_ARTILLERY: 0,
    HEAVY_ARTILLERY: 0,
  };

  const blueReserve: ReserveFleet = {
    INFANTRY: 0,
    ARMORED_INFANTRY: 0,
    AIRBORNE_INFANTRY: 0,
    ARTILLERY: 0,
    ARMORED_ARTILLERY: 0,
    HEAVY_ARTILLERY: 0,
  };

  const [boardFen, redReserveFen, blueReserveFen] = fen.split(" ");

  let i = 0;
  let j = 0;
  for (const char of boardFen) {
    if (char === "/") {
      i++;
      j = 0;
    } else if (char.match(/[1-8]/)) {
      j += parseInt(char);
    } else {
      const { piece, orientation } = parseFENChar(char);

      if (piece) {
        board[i][j] = piece;
        j++;
      } else if (orientation !== undefined && j > 0) {
        const prevSquare = board[i][j - 1];
        if (prevSquare) {
          prevSquare.orientation = orientation;
        } else {
          throw new Error("Invalid FEN string");
        }
      }
    }
  }

  for (const char of redReserveFen ?? "") {
    const piece = charToPiece(char);
    if (piece) {
      redReserve[piece.type as keyof ReserveFleet]++;
    }
  }

  for (const char of blueReserveFen ?? "") {
    const piece = charToPiece(char);
    if (piece) {
      blueReserve[piece.type as keyof ReserveFleet]++;
    }
  }

  return { board, redReserve, blueReserve };
}

function parseFENChar(char: string): {
  piece: NonNullSquare | undefined;
  orientation: Orientation | undefined;
} {
  const piece = charToPiece(char);
  const orientation = charToOrientation(char);
  return { piece, orientation };
}

const symbolToUnit = {
  Q: "HQ",
  I: "INFANTRY",
  F: "ARMORED_INFANTRY",
  P: "AIRBORNE_INFANTRY",
  R: "ARTILLERY",
  T: "ARMORED_ARTILLERY",
  H: "HEAVY_ARTILLERY",
};

export const unitToSymbol = Object.fromEntries(
  Object.entries(symbolToUnit).map(([key, value]) => [value, key])
);

function pieceToString(piece: NonNullSquare): string {
  if (!(piece?.type in unitToSymbol)) {
    throw new Error("Invalid piece type");
  }

  const symbol = unitToSymbol[piece.type];
  const unit =
    piece.player === "RED" ? symbol.toUpperCase() : symbol.toLowerCase();
  const rotation =
    piece.orientation !== undefined ? degreesToCardinal(piece.orientation) : "";

  return `${unit}${rotation}`;
}

export function charToPiece(str: string): NonNullSquare | undefined {
  if (str.length !== 1) {
    return undefined;
  }

  const unitSymbol = str[0].toUpperCase() as keyof typeof symbolToUnit;
  const player = str[0] === str[0].toUpperCase() ? "RED" : "BLUE";

  if (!(unitSymbol in symbolToUnit)) {
    return undefined;
  }

  const type = symbolToUnit[unitSymbol];
  return { type, player };
}

function charToOrientation(str: string): Orientation | undefined {
  if (str.length !== 1) {
    return undefined;
  }

  return cardinalToDegrees(str);
}

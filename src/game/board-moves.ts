import { Ctx } from "boardgame.io";
import { areCoordsEqual, captureCandidatesV2 } from "./capture-logic";
import {
  AllowedMove,
  Coordinate,
  GHQState,
  NonNullSquare,
  Orientation,
  orientations,
  Player,
  ReserveFleet,
  Units,
} from "./engine";
import { movesForActivePiece, spawnPositionsForPlayer } from "./move-logic";

export interface PlayerPiece {
  piece: NonNullSquare;
  coordinate: Coordinate;
}

export function coordsForThisTurnMoves(
  thisTurnMoves: AllowedMove[]
): Coordinate[] {
  return thisTurnMoves
    .filter(
      (move) =>
        move.name === "Move" ||
        move.name === "MoveAndOrient" ||
        move.name === "Reinforce"
    )
    .map((move) => {
      // Assume the 2nd arg is the coordinate the piece landed on)
      return move.args[1];
    });
}

export function getAllowedMoves({
  board,
  redReserve,
  blueReserve,
  currentPlayerTurn,
  thisTurnMoves,
}: {
  board: GHQState["board"];
  thisTurnMoves: AllowedMove[];
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;
  currentPlayerTurn: Player;
}): AllowedMove[] {
  const allMoves: AllowedMove[] = [];

  const thisTurnMoveCoordinates = new Set(
    coordsForThisTurnMoves(thisTurnMoves).map(
      (coord) => `${coord[0]},${coord[1]}`
    )
  );

  // Find all reinforce moves available
  const spawnPositions = spawnPositionsForPlayer(board, currentPlayerTurn);

  const reserve = currentPlayerTurn === "RED" ? redReserve : blueReserve;
  for (const [unitType, quantity] of Object.entries(reserve)) {
    if (quantity <= 0) {
      continue;
    }

    for (const spawnPosition of spawnPositions) {
      const piece = {
        player: currentPlayerTurn,
        type: unitType as keyof ReserveFleet,
      };
      allMoves.push({
        name: "Reinforce",
        args: [piece.type, spawnPosition],
      });

      // Calculate possible captures for spawn.
      const captures = captureCandidatesV2({
        attacker: piece,
        attackerFrom: [-1, -1], // hack: we're not on the board
        attackerTo: spawnPosition,
        board,
      });
      for (const capture of captures) {
        allMoves.push({
          name: "Reinforce",
          args: [piece.type, spawnPosition, capture],
        });
      }
    }
  }

  const playerPieces = getPlayerPieces(board, currentPlayerTurn);
  for (const playerPiece of playerPieces) {
    const moves = movesForActivePiece(playerPiece.coordinate, board);

    // Artillery can decide to stay in the same place
    if (isPieceArtillery(playerPiece.piece)) {
      moves.push(playerPiece.coordinate);
    }

    for (const move of moves) {
      const currentPieceCoordinate = `${playerPiece.coordinate[0]},${playerPiece.coordinate[1]}`;
      if (thisTurnMoveCoordinates.has(currentPieceCoordinate)) {
        continue;
      }

      if (isPieceArtillery(playerPiece.piece)) {
        for (const angle of orientations) {
          // Artillery can't stay in the same orientation at the same location
          if (
            angle === playerPiece.piece.orientation &&
            areCoordsEqual(playerPiece.coordinate, move)
          ) {
            continue;
          }

          allMoves.push({
            name: "MoveAndOrient",
            args: [playerPiece.coordinate, move, angle],
          });
        }
      } else {
        allMoves.push({ name: "Move", args: [playerPiece.coordinate, move] });

        const captures = captureCandidatesV2({
          attacker: playerPiece.piece,
          attackerFrom: playerPiece.coordinate,
          attackerTo: move,
          board,
        });
        for (const capture of captures) {
          allMoves.push({
            name: "Move",
            args: [playerPiece.coordinate, move, capture],
          });
        }
      }
    }
  }

  // Shuffle the moves to randomize the order of the moves
  shuffleArray(allMoves);

  return allMoves;
}

// Simple Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
}

function getPlayerPieces(
  board: GHQState["board"],
  currentPlayerTurn: Player
): PlayerPiece[] {
  const playerPieces: PlayerPiece[] = [];
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      const piece = board[x][y];
      if (piece && piece.player === currentPlayerTurn) {
        playerPieces.push({
          piece,
          coordinate: [x, y],
        });
      }
    }
  }
  return playerPieces;
}

export function isPieceArtillery(piece: NonNullSquare) {
  return (
    piece.type === "ARTILLERY" ||
    piece.type === "ARMORED_ARTILLERY" ||
    piece.type === "HEAVY_ARTILLERY"
  );
}

export function isMoveAllowed(G: GHQState, ctx: Ctx, move: AllowedMove) {
  const allowedMoves = getAllowedMoves({
    board: G.board,
    redReserve: G.redReserve,
    blueReserve: G.blueReserve,
    currentPlayerTurn: ctx.currentPlayer === "0" ? "RED" : "BLUE",
    thisTurnMoves: G.thisTurnMoves,
  });

  const candidateMove = moveToNotation(move);

  for (const allowedMove of allowedMoves) {
    if (candidateMove === moveToNotation(allowedMove)) {
      return true;
    }
  }

  return false;
}

export function moveToNotation(move: AllowedMove): string {
  switch (move.name) {
    case "Move":
      return `${move.args[0]} -> ${move.args[1]}${
        move.args[2] ? ` x ${move.args[2]}` : ""
      }`;
    case "MoveAndOrient":
      return `${move.args[0]} -> ${move.args[1]} facing ${move.args[2]}`;
    case "Reinforce":
      return `Reinforce ${move.args[0]} at ${move.args[1]}`;
    case "Skip":
      return "Skip";
  }
}

export function isBombardedBy(
  board: GHQState["board"],
  fromCoordinate: Coordinate,
  toCoordinate: Coordinate,
  orientation: Orientation | undefined,
  target: Coordinate
): boolean {
  const square = board[fromCoordinate[0]][fromCoordinate[1]];
  if (!square || orientation === undefined) {
    return false;
  }

  const orientationVectors = {
    0: [-1, 0], // Up
    45: [-1, 1], // Top-Right
    90: [0, 1], // Right
    135: [1, 1], // Bottom-Right
    180: [1, 0], // Down
    225: [1, -1], // Bottom-Left
    270: [0, -1], // Left
    315: [-1, -1], // Top-Left
  };

  const range = Units[square.type].artilleryRange!;

  let currentX = toCoordinate[0];
  let currentY = toCoordinate[1];
  const orientationVector = orientationVectors[orientation];

  for (let i = 0; i < range; i++) {
    currentX += orientationVector[0];
    currentY += orientationVector[1];

    // off board, stop
    if (!(currentX >= 0 && currentX < 8 && currentY >= 0 && currentY < 8)) {
      break;
    }

    if (currentX === target[0] && currentY === target[1]) {
      return true;
    }
  }

  return false;
}

export function getOpponent(player: Player): Player {
  return player === "RED" ? "BLUE" : "RED";
}

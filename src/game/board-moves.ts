import { Ctx } from "boardgame.io";
import { captureCandidatesV2 } from "./capture-logic";
import {
  AllowedMove,
  Coordinate,
  GHQState,
  NonNullSquare,
  orientations,
  Player,
  ReserveFleet,
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
  const allMoves: AllowedMove[] = [{ name: "Skip", args: [] }];

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

    const type = unitType as keyof ReserveFleet;

    for (const spawnPosition of spawnPositions) {
      allMoves.push({
        name: "Reinforce",
        args: [type, spawnPosition],
      });

      const piece: NonNullSquare = {
        type,
        player: currentPlayerTurn,
      };
      const captures = captureCandidatesV2({
        attacker: piece,
        attackerFrom: null,
        attackerTo: spawnPosition,
        board,
      });
      for (const capture of captures) {
        allMoves.push({
          name: "Reinforce",
          args: [type, spawnPosition, capture],
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

  return allMoves;
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

function moveToNotation(move: AllowedMove): string {
  switch (move.name) {
    case "Move":
      return `${move.args[0]} -> ${move.args[1]}${
        move.args[2] ? ` x ${move.args[2]}` : ""
      }`;
    case "MoveAndOrient":
      return `${move.args[0]} -> ${move.args[1]} facing ${move.args[2]}`;
    case "Reinforce":
      return `Reinforce ${move.args[0]} -> ${move.args[1]}${
        move.args[2] ? ` x ${move.args[2]}` : ""
      }`;
    case "Skip":
      return "Skip";
  }
}

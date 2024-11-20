import {
  AllowedMove,
  Coordinate,
  GHQState,
  NonNullSquare,
  Player,
  ReserveFleet,
  Square,
  Units,
} from "@/game/engine";
import type { Ctx, LogEntry } from "boardgame.io";
import { bombardedSquares } from "@/game/move-logic";
import { HistoryState } from "./move-history-plugin";
import { BoardProps } from "boardgame.io/react";
import { PlayerPiece } from "./board-moves";

export function captureCandidates(
  lastMovedInfantry: Coordinate,
  board: GHQState["board"]
): Coordinate[] {
  const engagedPairs = maximizeEngagement(board, lastMovedInfantry);
  const attacker = board[lastMovedInfantry[0]][lastMovedInfantry[1]];

  if (!attacker) {
    throw new Error("No piece at the last moved infantry position");
  }

  // If you're not infantry, you're not capturing anything boi
  if (!isInfantry(attacker)) {
    return [];
  }

  const engagedInfantry: Record<string, Player> = {};
  for (const pairs of engagedPairs) {
    engagedInfantry[`${pairs.RED[0]},${pairs.RED[1]}`] = "RED";
    engagedInfantry[`${pairs.BLUE[0]},${pairs.BLUE[1]}`] = "BLUE";
  }

  // If moving here could result in more engaged pairs, then we can't capture anything.
  const potentiallyEngagedPairs = maximizeEngagement(board, null);
  if (potentiallyEngagedPairs.length > engagedPairs.length) {
    return [];
  }

  return findAdjacentAttackablePieces(
    board,
    engagedInfantry,
    attacker,
    lastMovedInfantry
  );
}

function findAdjacentAttackablePieces(
  board: GHQState["board"],
  engagedInfantry: Record<string, Player>,
  attacker: NonNullSquare,
  attackerCoords: Coordinate
): Coordinate[] {
  const attackerAdjacentPieces = getAdjacentPieces(board, attackerCoords);

  // Find capturable pieces
  const attackablePieces = attackerAdjacentPieces.filter((coord) => {
    const piece = board[coord[0]][coord[1]];

    // It must be an enemy piece
    if (!isEnemyPiece({ piece, attacker })) {
      return false;
    }

    // If it is already engaged, it's capturable
    if (isAlreadyEngaged(engagedInfantry, coord)) {
      return true;
    }

    // If it's an artillery that we're not standing in it's line of fire, it's capturable
    if (isNonDirectArtillery(piece, coord, attackerCoords)) {
      return true;
    }

    // If it's capturable HQ, it's capturable
    if (
      isCapturableHQ({
        board,
        engagedInfantry,
        lastMovedInfantry: attackerCoords,
        coord,
        attacker,
      })
    ) {
      return true;
    }

    return false;
  });

  return attackablePieces;
}

function getAdjacentPieces(
  board: GHQState["board"],
  coord: Coordinate
): Coordinate[] {
  const adjacentPieces: Coordinate[] = [];
  const directions = [
    [-1, 0], // Up
    [1, 0], // Down
    [0, -1], // Left
    [0, 1], // Right
  ];

  for (const [dx, dy] of directions) {
    const x = coord[0] + dx;
    const y = coord[1] + dy;

    if (x >= 0 && x < board.length && y >= 0 && y < board[0].length) {
      adjacentPieces.push([x, y]);
    }
  }

  return adjacentPieces;
}

function maximizeEngagement(
  board: GHQState["board"],
  excludeCoordinate: Coordinate | null,
  attacker?: NonNullSquare,
  attackerCoordinates?: Coordinate
): Record<Player, Coordinate>[] {
  const N = 8; // Size of the board

  // Arrays to hold the positions of '0' and '1' pieces
  const pieces0: { x: number; y: number }[] = [];
  const pieces1: { x: number; y: number }[] = [];

  // Maps to assign an index to each piece for easy reference
  const piece0Index: Record<string, number> = {};
  const piece1Index: Record<string, number> = {};

  let index0 = 0;
  let index1 = 0;

  // Populate pieces0 and pieces1 arrays and their indices
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      // Skip the last moved piece, we want to calculate engagement as if they weren't there
      if (
        excludeCoordinate &&
        excludeCoordinate[0] === i &&
        excludeCoordinate[1] === j
      ) {
        continue;
      }

      let attackerUnit: Square = null;
      if (
        attacker &&
        attackerCoordinates &&
        attackerCoordinates[0] === i &&
        attackerCoordinates[1] === j
      ) {
        attackerUnit = attacker;
      }

      const unit = attackerUnit || board[i]?.[j];
      if (!unit) {
        continue;
      }

      // Only units that can capture can be engaged
      if (!Units[unit.type].canCapture) {
        continue;
      }

      if (unit.player === "RED") {
        pieces0.push({ x: i, y: j });
        piece0Index[`${i},${j}`] = index0++;
      } else if (unit.player === "BLUE") {
        pieces1.push({ x: i, y: j });
        piece1Index[`${i},${j}`] = index1++;
      }
    }
  }

  // Build the adjacency list for pieces of '0' to their adjacent '1's
  const adjList: number[][] = Array.from({ length: pieces0.length }, () => []);
  const directions = [
    [-1, 0], // Up
    [1, 0], // Down
    [0, -1], // Left
    [0, 1], // Right
  ];

  for (let i = 0; i < pieces0.length; i++) {
    const { x: x0, y: y0 } = pieces0[i];

    for (const [dx, dy] of directions) {
      const x1 = x0 + dx;
      const y1 = y0 + dy;

      // Check if the adjacent position is within bounds and has a '1'
      if (
        (x1 >= 0 &&
          x1 < N &&
          y1 >= 0 &&
          y1 < N &&
          // If red is attacking, then we're looking for any blue piece as a pair
          board[x1]?.[y1]?.player === "BLUE") ||
        // But if blue is attacking, the board won't have the blue piece there yet, so we need to check the attacker coordinates
        (attackerCoordinates &&
          x1 === attackerCoordinates[0] &&
          y1 === attackerCoordinates[1])
      ) {
        if (
          excludeCoordinate &&
          excludeCoordinate[0] === x1 &&
          excludeCoordinate[1] === y1
        ) {
          continue;
        }
        const idx1 = piece1Index[`${x1},${y1}`];
        if (idx1 !== undefined) {
          adjList[i].push(idx1);
        }
      }
    }
  }

  // Initialize matching array for pieces of '1'
  const matchTo1 = Array(pieces1.length).fill(-1);

  // Helper function to perform DFS and find augmenting paths
  function bpm(u: number, seen: boolean[]) {
    for (const v of adjList[u]) {
      if (!seen[v]) {
        seen[v] = true;

        // If the '1' piece is not matched or can be rematched
        if (matchTo1[v] === -1 || bpm(matchTo1[v], seen)) {
          matchTo1[v] = u;
          return true;
        }
      }
    }
    return false;
  }

  // Attempt to find a matching for each '0' piece
  for (let u = 0; u < pieces0.length; u++) {
    const seen = Array(pieces1.length).fill(false);
    bpm(u, seen);
  }

  // Build the list of engaged pairs
  const engagedPairs: Record<Player, Coordinate>[] = [];
  for (let v = 0; v < matchTo1.length; v++) {
    if (matchTo1[v] !== -1) {
      const u = matchTo1[v];
      const piece0 = pieces0[u];
      const piece1 = pieces1[v];
      engagedPairs.push({
        RED: [piece0.x, piece0.y],
        BLUE: [piece1.x, piece1.y],
      });
    }
  }

  // Return the list of engaged pairs
  return engagedPairs;
}

export function clearBombardedSquares(
  G: GHQState,
  ctx: Ctx
): { coordinate: Coordinate; square: NonNullSquare }[] {
  const results: { coordinate: Coordinate; square: NonNullSquare }[] = [];

  const bombarded = bombardedSquares(G.board);

  G.board.forEach((rows, x) => {
    rows.forEach((square, y) => {
      const bombardedSquare = bombarded[`${x},${y}`];

      // If there is nothing here or it's not bombarded, do nothing.
      if (!square || !bombardedSquare) {
        return;
      }

      // If it's our turn, and we bombard the square, and the square is occupied by an enemy piece, remove it.
      const currentPlayerColor = ctx.currentPlayer === "0" ? "RED" : "BLUE";
      if (
        bombardedSquare[currentPlayerColor] &&
        square.player !== currentPlayerColor
      ) {
        G.board[x][y] = null;
        results.push({
          coordinate: [x, y],
          square,
        });
      }
    });
  });

  return results;
}

function isEnemyPiece({
  piece,
  attacker,
}: {
  piece: Square;
  attacker: Square;
}): boolean {
  return !!piece && !!attacker && piece.player !== attacker.player;
}

function isAlreadyEngaged(
  engagedInfantry: Record<string, Player>,
  coord: Coordinate
): boolean {
  return !!engagedInfantry[`${coord[0]},${coord[1]}`];
}

function isInfantry(square?: Square): boolean {
  return !!square && Units[square.type].canCapture;
}

function isHQ(square: Square): boolean {
  return !!square && square.type === "HQ";
}

function isCapturableHQ({
  board,
  engagedInfantry,
  lastMovedInfantry,
  coord,
  attacker,
}: {
  board: GHQState["board"];
  engagedInfantry: Record<string, Player>;
  lastMovedInfantry: Coordinate;
  coord: Coordinate;
  attacker: Square;
}): boolean {
  if (!attacker) {
    return false;
  }

  if (!isHQ(board[coord[0]][coord[1]])) {
    return false;
  }

  const hqAdjacentCoords = getAdjacentPieces(board, coord);
  for (const hqAttackerCoord of hqAdjacentCoords) {
    if (
      hqAttackerCoord[0] === lastMovedInfantry[0] &&
      hqAttackerCoord[1] === lastMovedInfantry[1]
    ) {
      continue;
    }

    const hqAttacker = board[hqAttackerCoord[0]][hqAttackerCoord[1]];
    if (
      hqAttacker &&
      hqAttacker.player === attacker.player &&
      isInfantry(hqAttacker) &&
      !isAlreadyEngaged(engagedInfantry, hqAttackerCoord)
    ) {
      return true;
    }
  }

  return false;
}

function isArtillery(piece: Square): boolean {
  return (
    !!piece &&
    (piece.type === "ARTILLERY" ||
      piece.type === "ARMORED_ARTILLERY" ||
      piece.type === "HEAVY_ARTILLERY") &&
    piece.orientation !== undefined
  );
}

function isNonDirectArtillery(
  piece: Square,
  coord: Coordinate,
  attackerCoords: Coordinate
): boolean {
  if (!isArtillery(piece) || piece?.orientation === undefined) {
    return false;
  }

  // Calculate the direction vector based on the orientation
  const radians = (piece.orientation * Math.PI) / 180;
  const directionX = -Math.round(Math.cos(radians));
  const directionY = Math.round(Math.sin(radians));

  // Calculate the square directly in front of the artillery
  const front: Coordinate = [coord[0] + directionX, coord[1] + directionY];

  return !areCoordsEqual(front, attackerCoords);
}

function areCoordsEqual(coord1: Coordinate, coord2: Coordinate): boolean {
  return coord1[0] === coord2[0] && coord1[1] === coord2[1];
}

export type CapturedFleet = ReserveFleet;

export function getCapturedPieces({
  playerId,
  systemMessages,
  log,
}: {
  playerId: "0" | "1";
  systemMessages: HistoryState;
  log: BoardProps<GHQState>["log"];
}): CapturedFleet {
  const filteredLog: LogEntry[] = [];

  const undoneMoves: LogEntry[] = [];
  for (const entry of log) {
    if (entry.action.type === "UNDO") {
      const lastMove = filteredLog.pop();
      lastMove && undoneMoves.push(lastMove);
    } else if (entry.action.type === "REDO") {
      const lastUndoneMove = undoneMoves.pop();
      lastUndoneMove && filteredLog.push(lastUndoneMove);
    } else {
      filteredLog.push(entry);
    }
  }

  const playerCaptures = filteredLog
    .filter((entry) => entry.action.type === "MAKE_MOVE")
    .filter((entry) => entry.metadata?.capturedPieceType)
    .filter((entry) => entry.action.payload.playerID === playerId)
    .map((entry) => entry?.metadata?.capturedPieceType);

  const systemCaptures = systemMessages.log
    .filter((entry) => entry.playerId === playerId)
    .filter((entry) => entry.captured)
    .flatMap(({ captured }) => {
      return (captured ?? []).map(({ square }) => square?.type);
    });
  const capturedFleet: Record<string, number> = {
    INFANTRY: 0,
    ARMORED_INFANTRY: 0,
    AIRBORNE_INFANTRY: 0,
    ARTILLERY: 0,
    ARMORED_ARTILLERY: 0,
    HEAVY_ARTILLERY: 0,
  };

  for (const capture of [...playerCaptures, ...systemCaptures]) {
    if (!(capture in capturedFleet)) {
      capturedFleet[capture] = 0;
    }
    capturedFleet[capture]++;
  }

  return capturedFleet as CapturedFleet;
}

export interface CaptureCandidatesArgs {
  attacker: NonNullSquare;
  attackerFrom: Coordinate | null; // attackFrom is null if the piece was deployed from the reserve
  attackerTo: Coordinate;
  board: GHQState["board"];
}

export function captureCandidatesV2({
  attacker,
  attackerFrom,
  attackerTo,
  board,
}: CaptureCandidatesArgs): Coordinate[] {
  // If you're not infantry, you're not capturing anything boi
  if (!isInfantry(attacker)) {
    return [];
  }

  const engagedPairs = maximizeEngagementV2(
    board,
    attacker,
    attackerFrom,
    attackerTo
  );

  const engagedInfantry: Record<string, Player> = {};
  for (const pairs of engagedPairs) {
    engagedInfantry[`${pairs.RED[0]},${pairs.RED[1]}`] = "RED";
    engagedInfantry[`${pairs.BLUE[0]},${pairs.BLUE[1]}`] = "BLUE";
  }

  // If this piece would be engaged in the new position, it can't capture anything
  const attackerToKey = `${attackerTo[0]},${attackerTo[1]}`;
  if (engagedInfantry[attackerToKey]) {
    return [];
  }

  return findAdjacentAttackablePieces(
    board,
    engagedInfantry,
    attacker,
    attackerTo
  );
}

function maximizeEngagementV2(
  board: GHQState["board"],
  attacker: NonNullSquare,
  attackerFrom: Coordinate | null,
  attackerTo: Coordinate
): Record<Player, Coordinate>[] {
  const N = 8; // Size of the board

  // Arrays to hold the positions of '0' and '1' pieces
  const pieces0: { x: number; y: number }[] = [];
  const pieces1: { x: number; y: number }[] = [];

  // Maps to assign an index to each piece for easy reference
  const piece0Index: Record<string, number> = {};
  const piece1Index: Record<string, number> = {};

  let index0 = 0;
  let index1 = 0;

  // Populate pieces0 and pieces1 arrays and their indices
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      // Skip the last moved piece, we want to calculate engagement as if they weren't there
      if (attackerFrom && attackerFrom[0] === i && attackerFrom[1] === j) {
        continue;
      }

      const unit = board[i]?.[j];
      if (!unit) {
        continue;
      }

      // Only units that can capture can be engaged
      if (!Units[unit.type].canCapture) {
        continue;
      }

      if (unit.player === "RED") {
        pieces0.push({ x: i, y: j });
        piece0Index[`${i},${j}`] = index0++;
      } else if (unit.player === "BLUE") {
        pieces1.push({ x: i, y: j });
        piece1Index[`${i},${j}`] = index1++;
      }
    }
  }

  // Add the attacker to the list of pieces at the end, to make it last priority for matching.
  if (attacker.player === "RED") {
    pieces0.push({ x: attackerTo[0], y: attackerTo[1] });
    piece0Index[`${attackerTo[0]},${attackerTo[1]}`] = index0++;
  } else {
    pieces1.push({ x: attackerTo[0], y: attackerTo[1] });
    piece1Index[`${attackerTo[0]},${attackerTo[1]}`] = index1++;
  }

  // Build the adjacency list for pieces of '0' to their adjacent '1's
  const adjList: number[][] = Array.from({ length: pieces0.length }, () => []);
  const directions = [
    [-1, 0], // Up
    [1, 0], // Down
    [0, -1], // Left
    [0, 1], // Right
  ];

  for (let i = 0; i < pieces0.length; i++) {
    const { x: x0, y: y0 } = pieces0[i];

    for (const [dx, dy] of directions) {
      const x1 = x0 + dx;
      const y1 = y0 + dy;

      // Check if the adjacent position is within bounds and has a '1'
      if (
        x1 >= 0 &&
        x1 < N &&
        y1 >= 0 &&
        y1 < N &&
        // If red is attacking, then we're looking for any blue piece as a pair
        (board[x1]?.[y1]?.player === "BLUE" ||
          // But if blue is attacking, the board won't have the blue piece there yet, so we need to check the attacker coordinates
          (attacker.player === "BLUE" &&
            x1 === attackerTo[0] &&
            y1 === attackerTo[1]))
      ) {
        const idx1 = piece1Index[`${x1},${y1}`];
        if (idx1 !== undefined) {
          // Put attacker last in the list, to prioritize other engagements first.
          if (x1 === attackerTo[0] && y1 === attackerTo[1]) {
            adjList[i].push(idx1);
          } else {
            adjList[i].unshift(idx1);
          }
        }
      }
    }
  }

  // Initialize matching array for pieces of '1'
  const matchTo1 = Array(pieces1.length).fill(-1);

  // Helper function to perform DFS and find augmenting paths
  function bpm(u: number, seen: boolean[]) {
    for (const v of adjList[u]) {
      if (!seen[v]) {
        seen[v] = true;

        // If the '1' piece is not matched or can be rematched
        if (matchTo1[v] === -1 || bpm(matchTo1[v], seen)) {
          matchTo1[v] = u;
          return true;
        }
      }
    }
    return false;
  }

  // Attempt to find a matching for each '0' piece
  for (let u = 0; u < pieces0.length; u++) {
    const seen = Array(pieces1.length).fill(false);
    bpm(u, seen);
  }

  // Build the list of engaged pairs
  const engagedPairs: Record<Player, Coordinate>[] = [];
  for (let v = 0; v < matchTo1.length; v++) {
    if (matchTo1[v] !== -1) {
      const u = matchTo1[v];
      const piece0 = pieces0[u];
      const piece1 = pieces1[v];
      engagedPairs.push({
        RED: [piece0.x, piece0.y],
        BLUE: [piece1.x, piece1.y],
      });
    }
  }

  // Return the list of engaged pairs
  return engagedPairs;
}

export interface FreeInfantryCapture {
  attacker: PlayerPiece;
  capture: PlayerPiece;
}

export function freeInfantryCaptures(
  board: GHQState["board"],
  currentPlayer: Player
): FreeInfantryCapture[] {
  const freeCaptures: FreeInfantryCapture[] = [];

  const engagedPairs = maximizeEngagement(board, null);
  const engagedInfantry: Record<string, Player> = {};
  for (const pairs of engagedPairs) {
    engagedInfantry[`${pairs.RED[0]},${pairs.RED[1]}`] = "RED";
    engagedInfantry[`${pairs.BLUE[0]},${pairs.BLUE[1]}`] = "BLUE";
  }

  const unengagedInfantry = findUnengagedInfantry(
    board,
    engagedInfantry,
    currentPlayer
  );

  for (const infantry of unengagedInfantry) {
    const attackablePieces = findAdjacentAttackablePieces(
      board,
      engagedInfantry,
      infantry.piece,
      infantry.coordinate
    );

    if (attackablePieces.length > 0) {
      // Take the first attackable piece we can find
      // Long term, we want to provide the user with the ability to select which piece they want to capture
      // Tehcnically, this implementation is somewhat wrong because it doesn't optimally match all the capturable pieces
      // In practice, it's a rare circumstance to arise, and it will be okay for now.
      const captureCoord = attackablePieces[0];
      const capturePiece = board[captureCoord[0]][captureCoord[1]];
      if (capturePiece) {
        freeCaptures.push({
          attacker: infantry,
          capture: { piece: capturePiece, coordinate: captureCoord },
        });
      }
    }
  }

  return freeCaptures;
}

function findUnengagedInfantry(
  board: GHQState["board"],
  engagedInfantry: Record<string, Player>,
  player: Player
): PlayerPiece[] {
  const unengagedInfantry: PlayerPiece[] = [];

  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      const piece = board[i][j];
      if (
        piece &&
        piece.player === player &&
        isInfantry(piece) &&
        !isAlreadyEngaged(engagedInfantry, [i, j])
      ) {
        unengagedInfantry.push({ piece, coordinate: [i, j] });
      }
    }
  }

  return unengagedInfantry;
}

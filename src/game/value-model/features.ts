import { bombardedSquares } from "@/game/move-logic";
import {
  Board,
  Coordinate,
  Player,
  ReserveFleet,
  UnitType,
  Units,
} from "@/game/engine";
import { unitScores } from "@/game/eval";

const PLAYERS: Player[] = ["RED", "BLUE"];
const PIECE_TYPES = [
  "HQ",
  "INFANTRY",
  "ARMORED_INFANTRY",
  "AIRBORNE_INFANTRY",
  "ARTILLERY",
  "ARMORED_ARTILLERY",
  "HEAVY_ARTILLERY",
] as const satisfies readonly UnitType[];
const RESERVE_TYPES = [
  "INFANTRY",
  "ARMORED_INFANTRY",
  "AIRBORNE_INFANTRY",
  "ARTILLERY",
  "ARMORED_ARTILLERY",
  "HEAVY_ARTILLERY",
] as const satisfies readonly (keyof ReserveFleet)[];
const INFANTRY_TYPES = new Set<UnitType>([
  "INFANTRY",
  "ARMORED_INFANTRY",
  "AIRBORNE_INFANTRY",
]);
const ARTILLERY_TYPES = new Set<UnitType>([
  "ARTILLERY",
  "ARMORED_ARTILLERY",
  "HEAVY_ARTILLERY",
]);

const SIDE_FEATURE_NAMES = [
  ...PIECE_TYPES.map((type) => `board_${type.toLowerCase()}`),
  ...RESERVE_TYPES.map((type) => `reserve_${type.toLowerCase()}`),
  "material_board",
  "material_total",
  "pieces_board",
  "pieces_reserve",
  "infantry_board",
  "artillery_board",
  "home_rank_occupancy",
  "max_rank_occupancy",
  "advancement_mean",
  "advancement_max",
  "unsupported_count",
  "unsupported_value",
  "support_distance_mean",
  "overextended_count",
  "overextended_value",
  "artillery_adjacent_pairs",
  "heavy_artillery_centered",
  "artillery_diagonal_count",
  "artillery_cardinal_count",
  "bombarded_squares",
  "bombarded_enemy_count",
  "bombarded_enemy_value",
  "artillery_protected_count",
  "artillery_diagonal_infantry_cover",
  "artillery_cardinal_infantry_cover",
  "infantry_engagements",
  "paratrooper_ready",
  "paratrooper_deployed",
  "paratrooper_distance_home",
  "paratrooper_supported",
  "paratrooper_engaged",
  "hq_bombarded",
  "hq_adjacent_enemy_infantry",
  "hq_adjacent_friendly",
  "hq_escape_squares",
  "pseudo_mobility",
] as const;

const DIFFERENCE_FEATURES = [
  "material_board",
  "material_total",
  "pieces_board",
  "infantry_board",
  "artillery_board",
  "home_rank_occupancy",
  "unsupported_value",
  "overextended_value",
  "bombarded_enemy_value",
  "artillery_protected_count",
  "paratrooper_ready",
  "paratrooper_deployed",
  "hq_bombarded",
  "hq_escape_squares",
  "pseudo_mobility",
] as const;

export const VALUE_FEATURE_NAMES = [
  "turn_progress",
  "board_fill",
  "surviving_unit_fraction",
  "own_to_move",
  ...SIDE_FEATURE_NAMES.map((name) => `own_${name}`),
  ...SIDE_FEATURE_NAMES.map((name) => `opp_${name}`),
  ...DIFFERENCE_FEATURES.map((name) => `diff_${name}`),
] as const;

export type ValueFeatureName = (typeof VALUE_FEATURE_NAMES)[number];
export type ValueFeatureRecord = Record<ValueFeatureName, number>;

export interface ValuePosition {
  board: Board;
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;
  currentPlayer: Player;
  turnNumber: number;
}

type PlacedPiece = {
  at: Coordinate;
  piece: Exclude<Board[number][number], null>;
};

type SideFeatureName = (typeof SIDE_FEATURE_NAMES)[number];
type SideFeatures = Record<SideFeatureName, number>;

function otherPlayer(player: Player): Player {
  return player === "RED" ? "BLUE" : "RED";
}

function homeRank(player: Player): number {
  return player === "RED" ? 7 : 0;
}

function chebyshev(a: Coordinate, b: Coordinate): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

function inside(row: number, column: number): boolean {
  return row >= 0 && row < 8 && column >= 0 && column < 8;
}

function neighbors(at: Coordinate, diagonal: boolean): Coordinate[] {
  const result: Coordinate[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (!diagonal && Math.abs(dr) + Math.abs(dc) !== 1) continue;
      const row = at[0] + dr;
      const column = at[1] + dc;
      if (inside(row, column)) result.push([row, column]);
    }
  }
  return result;
}

function piecesFor(board: Board, player: Player): PlacedPiece[] {
  const result: PlacedPiece[] = [];
  board.forEach((rank, row) =>
    rank.forEach((piece, column) => {
      if (piece?.player === player) result.push({ at: [row, column], piece });
    })
  );
  return result;
}

function reserveFor(position: ValuePosition, player: Player): ReserveFleet {
  return player === "RED" ? position.redReserve : position.blueReserve;
}

function nearestSupportDistance(
  candidate: PlacedPiece,
  friendly: PlacedPiece[]
): number {
  const distances = friendly
    .filter(
      (other) =>
        other !== candidate &&
        other.piece.type !== "HQ" &&
        other.piece.type !== "AIRBORNE_INFANTRY"
    )
    .map((other) => chebyshev(candidate.at, other.at));
  return distances.length === 0 ? 8 : Math.min(...distances);
}

function isHeavyCentered(heavy: PlacedPiece, artillery: PlacedPiece[]): boolean {
  const [row, column] = heavy.at;
  const sameRank = artillery.filter(
    (gun) => gun !== heavy && gun.at[0] === row
  );
  const sameFile = artillery.filter(
    (gun) => gun !== heavy && gun.at[1] === column
  );
  return (
    (sameRank.some((gun) => gun.at[1] < column) &&
      sameRank.some((gun) => gun.at[1] > column)) ||
    (sameFile.some((gun) => gun.at[0] < row) &&
      sameFile.some((gun) => gun.at[0] > row))
  );
}

function pseudoMobility(board: Board, pieces: PlacedPiece[]): number {
  let moves = 0;
  for (const { at, piece } of pieces) {
    if (piece.type === "HQ") continue;
    const speed = Units[piece.type].mobility;
    for (let row = Math.max(0, at[0] - speed); row <= Math.min(7, at[0] + speed); row++) {
      for (
        let column = Math.max(0, at[1] - speed);
        column <= Math.min(7, at[1] + speed);
        column++
      ) {
        if (row === at[0] && column === at[1]) continue;
        if (chebyshev(at, [row, column]) <= speed && board[row][column] === null) {
          moves++;
        }
      }
    }
  }
  return Math.log1p(moves);
}

function extractSideFeatures(
  position: ValuePosition,
  player: Player
): SideFeatures {
  const board = position.board;
  const opponent = otherPlayer(player);
  const friendly = piecesFor(board, player);
  const enemy = piecesFor(board, opponent);
  const reserve = reserveFor(position, player);
  const artillery = friendly.filter(({ piece }) => ARTILLERY_TYPES.has(piece.type));
  const infantry = friendly.filter(({ piece }) => INFANTRY_TYPES.has(piece.type));
  const bombardment = bombardedSquares(board);
  const ownHomeRank = homeRank(player);
  const counts = Object.fromEntries(PIECE_TYPES.map((type) => [type, 0])) as Record<
    (typeof PIECE_TYPES)[number],
    number
  >;
  friendly.forEach(({ piece }) => counts[piece.type]++);

  const result = Object.fromEntries(
    SIDE_FEATURE_NAMES.map((name) => [name, 0])
  ) as SideFeatures;
  PIECE_TYPES.forEach((type) => {
    result[`board_${type.toLowerCase()}` as SideFeatureName] = counts[type];
  });
  RESERVE_TYPES.forEach((type) => {
    result[`reserve_${type.toLowerCase()}` as SideFeatureName] = reserve[type] ?? 0;
  });

  result.material_board = friendly.reduce(
    (total, { piece }) => total + unitScores[piece.type],
    0
  );
  result.material_total =
    result.material_board +
    RESERVE_TYPES.reduce(
      (total, type) => total + (reserve[type] ?? 0) * unitScores[type],
      0
    );
  result.pieces_board = friendly.length;
  result.pieces_reserve = RESERVE_TYPES.reduce(
    (total, type) => total + (reserve[type] ?? 0),
    0
  );
  result.infantry_board = infantry.length;
  result.artillery_board = artillery.length;
  result.home_rank_occupancy = friendly.filter(({ at }) => at[0] === ownHomeRank).length;

  const rankCounts = Array(8).fill(0) as number[];
  friendly.forEach(({ at }) => rankCounts[at[0]]++);
  result.max_rank_occupancy = Math.max(0, ...rankCounts);
  const advances = friendly
    .filter(({ piece }) => piece.type !== "HQ")
    .map(({ at }) => Math.abs(at[0] - ownHomeRank));
  result.advancement_mean =
    advances.length === 0
      ? 0
      : advances.reduce((total, value) => total + value, 0) / advances.length;
  result.advancement_max = Math.max(0, ...advances);

  const eligibleForSupport = friendly.filter(
    ({ piece }) => piece.type !== "HQ" && piece.type !== "AIRBORNE_INFANTRY"
  );
  const rankPower = Array(8).fill(0) as number[];
  eligibleForSupport.forEach(({ at, piece }) => {
    rankPower[at[0]] += unitScores[piece.type];
  });
  const anchorRank = rankPower.indexOf(Math.max(...rankPower));
  let supportDistanceTotal = 0;
  for (const candidate of eligibleForSupport) {
    const distance = nearestSupportDistance(candidate, friendly);
    supportDistanceTotal += distance;
    if (distance > 1) {
      result.unsupported_count++;
      result.unsupported_value += unitScores[candidate.piece.type];
    }
    const ranksPastAnchor =
      player === "RED"
        ? anchorRank - candidate.at[0]
        : candidate.at[0] - anchorRank;
    if (ranksPastAnchor >= 2) {
      result.overextended_count++;
      result.overextended_value +=
        unitScores[candidate.piece.type] * (ranksPastAnchor - 1);
    }
  }
  result.support_distance_mean =
    eligibleForSupport.length === 0
      ? 0
      : supportDistanceTotal / eligibleForSupport.length;

  for (let first = 0; first < artillery.length; first++) {
    for (let second = first + 1; second < artillery.length; second++) {
      if (chebyshev(artillery[first].at, artillery[second].at) === 1) {
        result.artillery_adjacent_pairs++;
      }
    }
  }
  result.heavy_artillery_centered = artillery.some(
    (gun) => gun.piece.type === "HEAVY_ARTILLERY" && isHeavyCentered(gun, artillery)
  )
    ? 1
    : 0;

  for (const gun of artillery) {
    const orientation = gun.piece.orientation ?? (player === "RED" ? 0 : 180);
    if (orientation % 90 === 0) result.artillery_cardinal_count++;
    else result.artillery_diagonal_count++;
    let protectedGun = false;
    for (const at of neighbors(gun.at, true)) {
      const piece = board[at[0]][at[1]];
      if (piece?.player !== player || !INFANTRY_TYPES.has(piece.type)) continue;
      protectedGun = true;
      if (at[0] !== gun.at[0] && at[1] !== gun.at[1]) {
        result.artillery_diagonal_infantry_cover++;
      } else {
        result.artillery_cardinal_infantry_cover++;
      }
    }
    if (protectedGun) result.artillery_protected_count++;
  }

  for (const [key, control] of Object.entries(bombardment)) {
    if (!control[player]) continue;
    result.bombarded_squares++;
    const [row, column] = key.split(",").map(Number);
    const target = board[row][column];
    if (target?.player === opponent) {
      result.bombarded_enemy_count++;
      result.bombarded_enemy_value += unitScores[target.type];
    }
  }

  const seenEngagements = new Set<string>();
  for (const unit of infantry) {
    for (const at of neighbors(unit.at, false)) {
      const target = board[at[0]][at[1]];
      if (target?.player === opponent && INFANTRY_TYPES.has(target.type)) {
        const key = [unit.at.join(","), at.join(",")].sort().join("|");
        seenEngagements.add(key);
      }
    }
  }
  result.infantry_engagements = seenEngagements.size;

  const paratroopers = friendly.filter(
    ({ piece }) => piece.type === "AIRBORNE_INFANTRY"
  );
  result.paratrooper_ready =
    (reserve.AIRBORNE_INFANTRY ?? 0) > 0 ||
    paratroopers.some(({ at }) => at[0] === ownHomeRank)
      ? 1
      : 0;
  const deployedParatroopers = paratroopers.filter(({ at }) => at[0] !== ownHomeRank);
  result.paratrooper_deployed = deployedParatroopers.length;
  for (const para of deployedParatroopers) {
    result.paratrooper_distance_home += Math.abs(para.at[0] - ownHomeRank);
    if (
      neighbors(para.at, true).some(([row, column]) => {
        const piece = board[row][column];
        return piece?.player === player && piece.type !== "HQ";
      })
    ) {
      result.paratrooper_supported++;
    }
    if (
      neighbors(para.at, false).some(([row, column]) => {
        const piece = board[row][column];
        return piece?.player === opponent && INFANTRY_TYPES.has(piece.type);
      })
    ) {
      result.paratrooper_engaged++;
    }
  }

  const hq = friendly.find(({ piece }) => piece.type === "HQ");
  if (hq) {
    result.hq_bombarded = bombardment[hq.at.join(",")]?.[opponent] ? 1 : 0;
    for (const at of neighbors(hq.at, true)) {
      const piece = board[at[0]][at[1]];
      if (piece?.player === player) result.hq_adjacent_friendly++;
      if (
        piece?.player === opponent &&
        INFANTRY_TYPES.has(piece.type) &&
        (at[0] === hq.at[0] || at[1] === hq.at[1])
      ) {
        result.hq_adjacent_enemy_infantry++;
      }
      if (piece === null && !bombardment[at.join(",")]?.[opponent]) {
        const enemyInfantryAdjacent = neighbors(at, false).some(([row, column]) => {
          const neighbor = board[row][column];
          return neighbor?.player === opponent && INFANTRY_TYPES.has(neighbor.type);
        });
        if (!enemyInfantryAdjacent) result.hq_escape_squares++;
      }
    }
  } else {
    result.hq_bombarded = 1;
  }
  result.pseudo_mobility = pseudoMobility(board, friendly);
  return result;
}

export function extractValueFeatures(
  position: ValuePosition,
  perspective: Player
): number[] {
  const opponent = otherPlayer(perspective);
  const own = extractSideFeatures(position, perspective);
  const opp = extractSideFeatures(position, opponent);
  const totalReserve = PLAYERS.reduce(
    (total, player) =>
      total +
      RESERVE_TYPES.reduce(
        (subtotal, type) => subtotal + reserveFor(position, player)[type],
        0
      ),
    0
  );
  const occupied = position.board.flat().filter(Boolean).length;
  const nonHqOnBoard = position.board
    .flat()
    .filter((piece) => piece !== null && piece.type !== "HQ").length;
  const values = [
    Math.min(Math.max(position.turnNumber, 0), 100) / 100,
    occupied / 64,
    // Standard GHQ begins with 13 non-HQ units per player.
    (nonHqOnBoard + totalReserve) / 26,
    position.currentPlayer === perspective ? 1 : 0,
    ...SIDE_FEATURE_NAMES.map((name) => own[name]),
    ...SIDE_FEATURE_NAMES.map((name) => opp[name]),
    ...DIFFERENCE_FEATURES.map((name) => own[name] - opp[name]),
  ];
  if (
    values.length !== VALUE_FEATURE_NAMES.length ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Invalid GHQ value feature vector");
  }
  return values;
}

export function valueFeaturesToRecord(features: number[]): ValueFeatureRecord {
  if (features.length !== VALUE_FEATURE_NAMES.length) {
    throw new Error(
      `Expected ${VALUE_FEATURE_NAMES.length} value features, received ${features.length}`
    );
  }
  return Object.fromEntries(
    VALUE_FEATURE_NAMES.map((name, index) => [name, features[index]])
  ) as ValueFeatureRecord;
}

export function extractValueFeatureRecord(
  position: ValuePosition,
  perspective: Player
): ValueFeatureRecord {
  return valueFeaturesToRecord(extractValueFeatures(position, perspective));
}

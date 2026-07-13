import {
  AllowedMove,
  Board,
  Coordinate,
  NonNullSquare,
  Player,
  ReserveFleet,
} from "./engine";
import { captureCandidatesV2 } from "./capture-logic";
import { getPlayerPieces } from "./move-logic";

export const unitScores: Record<string, number> = {
  INFANTRY: 1,
  ARMORED_INFANTRY: 3,
  AIRBORNE_INFANTRY: 5,
  ARTILLERY: 3,
  ARMORED_ARTILLERY: 5,
  HEAVY_ARTILLERY: 6,
  HQ: 100,
};

/**
 * The initial, deliberately conservative, interpretation of the player's
 * "don't leave pieces hanging" heuristic.  A nearby HQ is not support: it
 * cannot capture and therefore cannot help a unit hold ground.
 *
 * These values are evaluation points, not probabilities.  They will be tuned
 * against annotated positions and self-play rather than treated as piece
 * values.
 */
export const hangingPieceWeights = {
  noAdjacentSupport: 0.5,
  threeOrMoreSquaresFromSupport: 0.25,
  twoRanksPastAnchor: 0.35,
} as const;

/**
 * A ready airborne infantry constrains the opponent even while it remains on
 * its home rank. Multiple exposed targets are deliberately worth much more
 * than a single target: they impose simultaneous defensive work and often
 * create a multi-action tactical conversion after the eventual drop.
 */
export const airborneDeterrenceWeights = {
  readyTarget: 0.75,
  additionalReadyTarget: 0.4,
  stagedReserveMultiplier: 0.25,
} as const;

export const artilleryFormationWeights = {
  adjacentArtilleryPair: 0.35,
  heavyArtilleryInFormationCenter: 1.0,
} as const;

export const openingDeploymentWeights = {
  occupiedHomeRankSquare: 0.25,
  targetHomeRankOccupancy: 7,
  // Once this many mobile pieces are deployed, formation and tactical
  // features should dominate this opening-development preference.
  developmentPhaseMobilePieceLimit: 10,
} as const;

export interface HangingPieceFeature {
  player: Player;
  at: Coordinate;
  type: NonNullSquare["type"];
  nearestSupportDistance: number | null;
  ranksPastAnchor: number;
  penalty: number;
}

export interface AirborneDeterrenceFeature {
  player: Player;
  readiness: "ready" | "staged";
  exposedArtillery: Coordinate[];
  bonus: number;
}

export interface ArtilleryFormationFeature {
  player: Player;
  adjacentPairs: number;
  heavyArtilleryCentered: boolean;
  bonus: number;
}

export interface OpeningDeploymentFeature {
  player: Player;
  homeRankOccupancy: number;
  bonus: number;
}

export interface EvalBoardState {
  board: Board;
  redReserve?: ReserveFleet;
  blueReserve?: ReserveFleet;
  currentPlayerTurn?: Player;
  thisTurnMoves?: AllowedMove[];
  isReplayMode?: boolean;
  enforceZoneOfControl?: boolean;
}

export function calculateEval({
  board,
  redReserve,
  blueReserve,
}: EvalBoardState): number {
  const scores: Record<Player, number> = {
    RED: 0,
    BLUE: 0,
  };

  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      const square = board[i][j];
      if (square === null) {
        continue;
      }

      scores[square.player] += unitScores[square.type] ?? 0;
    }
  }

  const hangingPenalty = hangingPieceFeatures(board).reduce(
    (totals, feature) => {
      totals[feature.player] += feature.penalty;
      return totals;
    },
    { RED: 0, BLUE: 0 } as Record<Player, number>
  );
  const airborneDeterrence = airborneDeterrenceFeatures(
    board,
    redReserve,
    blueReserve
  ).reduce(
    (totals, feature) => {
      totals[feature.player] += feature.bonus;
      return totals;
    },
    { RED: 0, BLUE: 0 } as Record<Player, number>
  );
  const artilleryFormation = artilleryFormationFeatures(board).reduce(
    (totals, feature) => {
      totals[feature.player] += feature.bonus;
      return totals;
    },
    { RED: 0, BLUE: 0 } as Record<Player, number>
  );
  const openingDeployment = openingDeploymentFeatures(board).reduce(
    (totals, feature) => {
      totals[feature.player] += feature.bonus;
      return totals;
    },
    { RED: 0, BLUE: 0 } as Record<Player, number>
  );

  return (
    scores.RED +
    airborneDeterrence.RED -
    hangingPenalty.RED +
    artilleryFormation.RED +
    openingDeployment.RED -
    (scores.BLUE +
      airborneDeterrence.BLUE +
      artilleryFormation.BLUE +
      openingDeployment.BLUE -
      hangingPenalty.BLUE)
  );
}

export function artilleryFormationFeatures(
  board: Board
): ArtilleryFormationFeature[] {
  const features: ArtilleryFormationFeature[] = [];

  for (const player of ["RED", "BLUE"] as const) {
    const artillery = playerPieces(board, player).filter(({ piece }) =>
      isArtillery(piece)
    );
    if (artillery.length < 2) continue;

    let adjacentPairs = 0;
    for (let i = 0; i < artillery.length; i++) {
      for (let j = i + 1; j < artillery.length; j++) {
        if (chebyshevDistance(artillery[i].at, artillery[j].at) === 1) {
          adjacentPairs++;
        }
      }
    }

    const heavyArtillery = artillery.find(
      ({ piece }) => piece.type === "HEAVY_ARTILLERY"
    );
    const heavyArtilleryCentered =
      !!heavyArtillery && isFormationCenter(heavyArtillery, artillery);
    const bonus =
      adjacentPairs * artilleryFormationWeights.adjacentArtilleryPair +
      (heavyArtilleryCentered
        ? artilleryFormationWeights.heavyArtilleryInFormationCenter
        : 0);

    if (bonus > 0) {
      features.push({
        player,
        adjacentPairs,
        heavyArtilleryCentered,
        bonus,
      });
    }
  }

  return features;
}

export function openingDeploymentFeatures(board: Board): OpeningDeploymentFeature[] {
  const features: OpeningDeploymentFeature[] = [];

  for (const player of ["RED", "BLUE"] as const) {
    const pieces = playerPieces(board, player);
    const mobilePieceCount = pieces.filter(
      ({ piece }) => piece.type !== "HQ"
    ).length;
    if (
      mobilePieceCount >=
      openingDeploymentWeights.developmentPhaseMobilePieceLimit
    ) {
      continue;
    }

    const homeRank = player === "RED" ? 7 : 0;
    const homeRankOccupancy = board[homeRank].filter(
      (piece) => piece?.player === player
    ).length;
    const bonus =
      Math.min(
        homeRankOccupancy,
        openingDeploymentWeights.targetHomeRankOccupancy
      ) * openingDeploymentWeights.occupiedHomeRankSquare;

    if (bonus > 0) features.push({ player, homeRankOccupancy, bonus });
  }

  return features;
}

export function airborneDeterrenceFeatures(
  board: Board,
  redReserve?: ReserveFleet,
  blueReserve?: ReserveFleet
): AirborneDeterrenceFeature[] {
  const features: AirborneDeterrenceFeature[] = [];

  for (const player of ["RED", "BLUE"] as const) {
    const reserve = player === "RED" ? redReserve : blueReserve;
    const readiness = airborneReadiness(board, player, reserve);
    if (!readiness) continue;

    const exposedArtillery = airborneCapturableArtillery(board, player);
    if (exposedArtillery.length === 0) continue;

    const targetValues = exposedArtillery
      .map(([row, column]) => board[row][column])
      .filter((piece): piece is NonNullSquare => piece !== null)
      .map((piece) => unitScores[piece.type])
      .sort((a, b) => b - a);
    const readyBonus =
      targetValues[0] * airborneDeterrenceWeights.readyTarget +
      targetValues
        .slice(1)
        .reduce(
          (total, value) =>
            total + value * airborneDeterrenceWeights.additionalReadyTarget,
          0
        );

    features.push({
      player,
      readiness,
      exposedArtillery,
      bonus:
        readiness === "ready"
          ? readyBonus
          : readyBonus * airborneDeterrenceWeights.stagedReserveMultiplier,
    });
  }

  return features;
}

/**
 * Return the individual penalties so a UI, test, or future bot explanation
 * can say *why* a position was scored poorly.
 */
export function hangingPieceFeatures(board: Board): HangingPieceFeature[] {
  const features: HangingPieceFeature[] = [];

  for (const player of ["RED", "BLUE"] as const) {
    const pieces = playerPieces(board, player);
    const anchorRank = mostPowerfulRank(pieces, player);

    for (const candidate of pieces) {
      // HQ blocks and matters strategically, but is not a supporting unit.
      if (candidate.piece.type === "HQ") continue;
      // A paratrooper on its own back rank is intentionally held ready to
      // paradrop; treating that deliberate staging square as "hanging" would
      // erase the deterrence value modeled below.
      if (
        candidate.piece.type === "AIRBORNE_INFANTRY" &&
        candidate.at[0] === (player === "RED" ? 7 : 0)
      ) {
        continue;
      }

      const nearestSupportDistance = nearestSupportingPieceDistance(
        candidate,
        pieces
      );
      const ranksPastAnchor = ranksForwardOfAnchor(
        player,
        candidate.at,
        anchorRank
      );
      const value = unitScores[candidate.piece.type];
      let penalty = 0;

      if (nearestSupportDistance === null || nearestSupportDistance > 1) {
        penalty += value * hangingPieceWeights.noAdjacentSupport;
      }
      if (nearestSupportDistance === null || nearestSupportDistance >= 3) {
        penalty += value * hangingPieceWeights.threeOrMoreSquaresFromSupport;
      }
      if (ranksPastAnchor >= 2) {
        penalty += value * hangingPieceWeights.twoRanksPastAnchor;
      }

      if (penalty > 0) {
        features.push({
          player,
          at: candidate.at,
          type: candidate.piece.type,
          nearestSupportDistance,
          ranksPastAnchor,
          penalty,
        });
      }
    }
  }

  return features;
}

type PlacedPiece = { at: Coordinate; piece: NonNullSquare };

function playerPieces(board: Board, player: Player): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let column = 0; column < board[row].length; column++) {
      const piece = board[row][column];
      if (piece?.player === player) pieces.push({ at: [row, column], piece });
    }
  }
  return pieces;
}

function mostPowerfulRank(
  pieces: PlacedPiece[],
  player: Player
): number | null {

  const valueByRank = new Map<number, number>();
  for (const { at, piece } of pieces) {
    // HQ is strategically vital but contributes no mobile combat power.
    if (piece.type === "HQ") continue;
    valueByRank.set(
      at[0],
      (valueByRank.get(at[0]) ?? 0) + unitScores[piece.type]
    );
  }

  const ranks = [...valueByRank.entries()];
  if (ranks.length === 0) return null;

  return ranks.reduce((best, current) => {
    if (current[1] !== best[1]) return current[1] > best[1] ? current : best;

    // A tie is anchored to the more homeward rank: it is the safer line.
    return player === "RED"
      ? current[0] > best[0]
        ? current
        : best
      : current[0] < best[0]
        ? current
        : best;
  })[0];
}

function nearestSupportingPieceDistance(
  candidate: PlacedPiece,
  pieces: PlacedPiece[]
): number | null {
  const distances = pieces
    .filter(({ at, piece }) => piece.type !== "HQ" && at !== candidate.at)
    .map(({ at }) => chebyshevDistance(candidate.at, at));

  return distances.length === 0 ? null : Math.min(...distances);
}

function chebyshevDistance(
  [rowA, columnA]: Coordinate,
  [rowB, columnB]: Coordinate
) {
  return Math.max(Math.abs(rowA - rowB), Math.abs(columnA - columnB));
}

function ranksForwardOfAnchor(
  player: Player,
  [row]: Coordinate,
  anchorRank: number | null
): number {
  if (anchorRank === null) return 0;
  return player === "RED" ? anchorRank - row : row - anchorRank;
}

function airborneReadiness(
  board: Board,
  player: Player,
  reserve?: ReserveFleet
): "ready" | "staged" | null {
  const homeRank = player === "RED" ? 7 : 0;
  if (
    board[homeRank].some(
      (piece) =>
        piece?.player === player && piece.type === "AIRBORNE_INFANTRY"
    )
  ) {
    return "ready";
  }
  return reserve?.AIRBORNE_INFANTRY ? "staged" : null;
}

function airborneCapturableArtillery(
  board: Board,
  player: Player
): Coordinate[] {
  const attacker: NonNullSquare = { type: "AIRBORNE_INFANTRY", player };
  const { allowedSquares } = getPlayerPieces(board, player, true);
  const targets = new Map<string, Coordinate>();

  for (let row = 0; row < board.length; row++) {
    for (let column = 0; column < board[row].length; column++) {
      if (!allowedSquares[`${row},${column}`]) continue;

      for (const target of captureCandidatesV2({
        attacker,
        attackerFrom: [-1, -1],
        attackerTo: [row, column],
        board,
      })) {
        const targetPiece = board[target[0]][target[1]];
        if (
          targetPiece !== null &&
          targetPiece.player !== player &&
          isArtillery(targetPiece)
        ) {
          targets.set(`${target[0]},${target[1]}`, target);
        }
      }
    }
  }

  return [...targets.values()];
}

function isArtillery(piece: NonNullSquare): boolean {
  return (
    piece.type === "ARTILLERY" ||
    piece.type === "ARMORED_ARTILLERY" ||
    piece.type === "HEAVY_ARTILLERY"
  );
}

function isFormationCenter(
  heavyArtillery: PlacedPiece,
  artillery: PlacedPiece[]
): boolean {
  const companions = artillery.filter(({ at }) => at !== heavyArtillery.at);
  if (companions.length < 2) return false;

  const [row, column] = heavyArtillery.at;
  const sharesRowCenter = companions.some(({ at }) => at[1] < column) &&
    companions.some(({ at }) => at[1] > column);
  const sharesColumnCenter = companions.some(({ at }) => at[0] < row) &&
    companions.some(({ at }) => at[0] > row);

  return sharesRowCenter || sharesColumnCenter;
}

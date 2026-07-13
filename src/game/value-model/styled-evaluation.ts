import type { Player } from "@/game/engine";
import {
  extractValueFeatures,
  ValueFeatureRecord,
  ValuePosition,
  valueFeaturesToRecord,
} from "@/game/value-model/features";
import { predictWinProbability } from "@/game/value-model/inference";
import {
  PERSONALITIES,
  PersonalityId,
  PersonalityProfile,
  STYLE_FEATURE_NAMES,
  StyleFeatureName,
} from "@/game/value-model/personalities";

export type StyleFeatures = Record<StyleFeatureName, number>;

export interface StyleContribution {
  feature: StyleFeatureName;
  normalizedValue: number;
  weight: number;
  contribution: number;
}

export interface PersonalityEvaluation {
  personality: PersonalityId;
  objectiveWinProbability: number;
  objectiveLogOdds: number;
  styleFeatures: StyleFeatures;
  styleContributions: StyleContribution[];
  rawStyleBonus: number;
  styleBonus: number;
  riskPenalty: number;
  /** Ranking utility only; this is not a calibrated win probability. */
  selectionScore: number;
  /** A readable transform of selectionScore, not the objective model output. */
  preferenceProbability: number;
}

export interface PersonalityEvaluationOptions {
  objectiveWinProbability?: number;
  /** Normalized uncertainty or volatility from 0 through 1. */
  risk?: number;
  /** Zero for quiet positions; one suppresses style in fully forcing lines. */
  tacticality?: number;
}

export interface PersonalityCandidate<T = unknown>
  extends PersonalityEvaluationOptions {
  id: string;
  position: ValuePosition;
  payload?: T;
  forcedOutcome?: "win" | "loss";
}

export interface RankedPersonalityCandidate<T = unknown>
  extends PersonalityCandidate<T> {
  evaluation: PersonalityEvaluation;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalized(value: number, scale: number): number {
  return clamp(value / scale, -1, 1);
}

function logit(probability: number): number {
  const safe = clamp(probability, 1e-7, 1 - 1e-7);
  return Math.log(safe / (1 - safe));
}

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

export function extractStyleFeatures(features: ValueFeatureRecord): StyleFeatures {
  const artilleryFormation =
    features.own_artillery_adjacent_pairs -
    features.opp_artillery_adjacent_pairs +
    2 *
      (features.own_heavy_artillery_centered -
        features.opp_heavy_artillery_centered);
  const artilleryProtection =
    features.own_artillery_protected_count -
    features.opp_artillery_protected_count +
    0.35 *
      (features.own_artillery_diagonal_infantry_cover -
        features.opp_artillery_diagonal_infantry_cover);
  const paratrooperSurvival =
    0.6 * features.diff_paratrooper_ready +
    0.25 *
      (features.own_paratrooper_supported -
        features.opp_paratrooper_supported) -
    0.55 *
      (features.own_paratrooper_engaged - features.opp_paratrooper_engaged) -
    0.08 *
      (features.own_paratrooper_distance_home -
        features.opp_paratrooper_distance_home);
  const hqSafety =
    features.opp_hq_bombarded -
    features.own_hq_bombarded +
    0.12 * features.diff_hq_escape_squares +
    0.3 *
      (features.opp_hq_adjacent_enemy_infantry -
        features.own_hq_adjacent_enemy_infantry);
  const pressure = normalized(features.diff_bombarded_enemy_value, 15);
  const mobility = normalized(features.diff_pseudo_mobility, 2);

  return {
    cohesion: normalized(-features.diff_unsupported_value, 12),
    restraint: normalized(-features.diff_overextended_value, 12),
    mobility,
    infantry_strength: normalized(features.diff_infantry_board, 5),
    artillery_formation: normalized(artilleryFormation, 5),
    artillery_pressure: pressure,
    artillery_protection: normalized(artilleryProtection, 6),
    paratrooper_readiness: clamp(features.diff_paratrooper_ready, -1, 1),
    paratrooper_survival: clamp(paratrooperSurvival, -1, 1),
    hq_safety: clamp(hqSafety, -1, 1),
    initiative: clamp(
      0.5 * pressure +
        0.25 * mobility +
        0.25 *
          normalized(
            features.own_advancement_mean - features.opp_advancement_mean,
            4
          ),
      -1,
      1
    ),
    material_conservation: normalized(features.diff_material_total, 20),
  };
}

function styleContributions(
  profile: PersonalityProfile,
  styleFeatures: StyleFeatures
): StyleContribution[] {
  return STYLE_FEATURE_NAMES.map((feature) => {
    const weight = profile.styleWeights[feature] ?? 0;
    const normalizedValue = styleFeatures[feature];
    return {
      feature,
      normalizedValue,
      weight,
      contribution: normalizedValue * weight,
    };
  })
    .filter(({ weight }) => weight !== 0)
    .sort((left, right) =>
      Math.abs(right.contribution) - Math.abs(left.contribution)
    );
}

export function evaluatePersonalityPosition(
  position: ValuePosition,
  perspective: Player,
  personality: PersonalityId,
  options: PersonalityEvaluationOptions = {}
): PersonalityEvaluation {
  const profile = PERSONALITIES[personality];
  const featureVector = extractValueFeatures(position, perspective);
  const featureRecord = valueFeaturesToRecord(featureVector);
  const objectiveWinProbability = clamp(
    options.objectiveWinProbability ??
      predictWinProbability(position, perspective),
    0,
    1
  );
  const styleFeatures = extractStyleFeatures(featureRecord);
  const contributions = styleContributions(profile, styleFeatures);
  const rawStyleBonus = contributions.reduce(
    (total, item) => total + item.contribution,
    0
  );
  const tacticalMultiplier = 1 - clamp(options.tacticality ?? 0, 0, 1);
  const styleBonus = clamp(
    rawStyleBonus * tacticalMultiplier,
    -profile.styleBonusCap,
    profile.styleBonusCap
  );
  const riskPenalty = profile.riskAversion * clamp(options.risk ?? 0, 0, 1);
  const objectiveLogOdds = logit(objectiveWinProbability);
  const selectionScore = objectiveLogOdds + styleBonus - riskPenalty;
  return {
    personality,
    objectiveWinProbability,
    objectiveLogOdds,
    styleFeatures,
    styleContributions: contributions,
    rawStyleBonus,
    styleBonus,
    riskPenalty,
    selectionScore,
    preferenceProbability: sigmoid(selectionScore),
  };
}

/**
 * Rank only candidates inside the personality's objective-value envelope.
 * A proven win bypasses style; a proven loss is excluded whenever any
 * non-losing candidate exists.
 */
export function rankPersonalityCandidates<T>(
  candidates: PersonalityCandidate<T>[],
  perspective: Player,
  personality: PersonalityId
): RankedPersonalityCandidate<T>[] {
  if (candidates.length === 0) return [];
  const profile = PERSONALITIES[personality];
  const evaluated = candidates.map((candidate) => {
    const forcedProbability =
      candidate.forcedOutcome === "win"
        ? 1
        : candidate.forcedOutcome === "loss"
        ? 0
        : candidate.objectiveWinProbability;
    return {
      ...candidate,
      evaluation: evaluatePersonalityPosition(
        candidate.position,
        perspective,
        personality,
        {
          objectiveWinProbability: forcedProbability,
          risk: candidate.risk,
          tacticality:
            candidate.forcedOutcome === undefined ? candidate.tacticality : 1,
        }
      ),
    };
  });

  const forcedWins = evaluated.filter(
    (candidate) => candidate.forcedOutcome === "win"
  );
  if (forcedWins.length > 0) {
    return forcedWins.sort(
      (left, right) => right.evaluation.selectionScore - left.evaluation.selectionScore
    );
  }

  const nonLosing = evaluated.filter(
    (candidate) => candidate.forcedOutcome !== "loss"
  );
  const pool = nonLosing.length > 0 ? nonLosing : evaluated;
  const bestObjective = Math.max(
    ...pool.map((candidate) => candidate.evaluation.objectiveWinProbability)
  );
  return pool
    .filter(
      (candidate) =>
        candidate.evaluation.objectiveWinProbability >=
        bestObjective - profile.maxValueSacrifice - 1e-12
    )
    .sort((left, right) => {
      const scoreDifference =
        right.evaluation.selectionScore - left.evaluation.selectionScore;
      return scoreDifference !== 0
        ? scoreDifference
        : left.id.localeCompare(right.id);
    });
}

export function selectPersonalityCandidate<T>(
  candidates: PersonalityCandidate<T>[],
  perspective: Player,
  personality: PersonalityId
): RankedPersonalityCandidate<T> | undefined {
  return rankPersonalityCandidates(candidates, perspective, personality)[0];
}

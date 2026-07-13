import type { Player } from "@/game/engine";
import {
  extractValueFeatures,
  VALUE_FEATURE_NAMES,
  ValuePosition,
} from "@/game/value-model/features";
import generatedModel from "@/game/value-model/model.generated.json";

interface ExportedTree {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[];
}

export interface ValueModelArtifact {
  format: "ghq-gradient-boosted-value-v1";
  feature_names: string[];
  base_raw_score: number;
  learning_rate: number;
  calibration: {
    kind: "platt";
    scale: number;
    intercept: number;
  };
  trees: ExportedTree[];
  metadata: Record<string, unknown>;
}

const model = generatedModel as unknown as ValueModelArtifact;

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function evaluateTree(tree: ExportedTree, features: number[]): number {
  let node = 0;
  while (tree.children_left[node] !== -1) {
    const feature = tree.feature[node];
    node =
      features[feature] <= tree.threshold[node]
        ? tree.children_left[node]
        : tree.children_right[node];
  }
  return tree.value[node];
}

export function assertValueModelCompatible(
  artifact: ValueModelArtifact = model
): void {
  if (artifact.format !== "ghq-gradient-boosted-value-v1") {
    throw new Error(`Unsupported GHQ value model format: ${artifact.format}`);
  }
  if (
    artifact.feature_names.length !== VALUE_FEATURE_NAMES.length ||
    artifact.feature_names.some(
      (feature, index) => feature !== VALUE_FEATURE_NAMES[index]
    )
  ) {
    throw new Error("GHQ value model feature schema does not match the runtime");
  }
}

export function predictFromFeatures(
  features: number[],
  artifact: ValueModelArtifact = model
): number {
  assertValueModelCompatible(artifact);
  if (features.length !== artifact.feature_names.length) {
    throw new Error(
      `Expected ${artifact.feature_names.length} value features, received ${features.length}`
    );
  }
  let raw = artifact.base_raw_score;
  for (const tree of artifact.trees) {
    raw += artifact.learning_rate * evaluateTree(tree, features);
  }
  return sigmoid(
    artifact.calibration.scale * raw + artifact.calibration.intercept
  );
}

export function predictWinProbability(
  position: ValuePosition,
  perspective: Player
): number {
  const ownHq = position.board
    .flat()
    .some((piece) => piece?.type === "HQ" && piece.player === perspective);
  const opponent = perspective === "RED" ? "BLUE" : "RED";
  const opponentHq = position.board
    .flat()
    .some((piece) => piece?.type === "HQ" && piece.player === opponent);
  if (!ownHq) return 0;
  if (!opponentHq) return 1;
  return predictFromFeatures(extractValueFeatures(position, perspective));
}

export const VALUE_MODEL_METADATA = model.metadata;

#!/usr/bin/env python3
"""Train and export a Vercel-compatible gradient-boosted GHQ value model."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def load_dataset(path: Path) -> Tuple[List[str], List[Dict[str, Any]], np.ndarray, np.ndarray]:
    feature_names: List[str] | None = None
    rows: List[Dict[str, Any]] = []
    vectors: List[List[float]] = []
    labels: List[int] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            item = json.loads(line)
            if item.get("type") == "schema":
                feature_names = list(item["feature_names"])
                continue
            if item.get("type") != "sample":
                continue
            vector = item.pop("features")
            if feature_names is None or len(vector) != len(feature_names):
                raise ValueError("feature schema mismatch")
            rows.append(item)
            vectors.append(vector)
            labels.append(int(item["label"]))
    if not feature_names or not rows:
        raise ValueError("empty value-model dataset")
    return feature_names, rows, np.asarray(vectors, dtype=np.float64), np.asarray(labels, dtype=np.int8)


def chronological_split(rows: List[Dict[str, Any]]) -> Dict[str, np.ndarray]:
    game_dates: Dict[str, str] = {}
    for row in rows:
        game_dates[row["game_id"]] = row["created_at"]
    games = sorted(game_dates, key=lambda game_id: (game_dates[game_id], game_id))
    if len(games) < 30:
        raise ValueError("at least 30 games are required for train/validation/test splits")
    train_end = max(1, int(len(games) * 0.70))
    validation_end = max(train_end + 1, int(len(games) * 0.85))
    sets = {
        "train": set(games[:train_end]),
        "validation": set(games[train_end:validation_end]),
        "test": set(games[validation_end:]),
    }
    return {
        name: np.asarray([index for index, row in enumerate(rows) if row["game_id"] in game_ids])
        for name, game_ids in sets.items()
    }


def game_balanced_weights(rows: List[Dict[str, Any]], indices: np.ndarray) -> np.ndarray:
    counts = Counter(rows[index]["game_id"] for index in indices)
    weights = np.asarray([1.0 / counts[rows[index]["game_id"]] for index in indices])
    return weights / weights.mean()


def safe_logit(probabilities: np.ndarray) -> np.ndarray:
    clipped = np.clip(probabilities, 1e-7, 1 - 1e-7)
    return np.log(clipped / (1 - clipped))


def sigmoid(values: np.ndarray) -> np.ndarray:
    positive = values >= 0
    result = np.empty_like(values, dtype=np.float64)
    result[positive] = 1.0 / (1.0 + np.exp(-values[positive]))
    exp_values = np.exp(values[~positive])
    result[~positive] = exp_values / (1.0 + exp_values)
    return result


def metrics(labels: np.ndarray, probabilities: np.ndarray, weights: np.ndarray) -> Dict[str, float]:
    return {
        "log_loss": round(float(log_loss(labels, probabilities, sample_weight=weights)), 6),
        "brier": round(float(brier_score_loss(labels, probabilities, sample_weight=weights)), 6),
        "accuracy": round(
            float(accuracy_score(labels, probabilities >= 0.5, sample_weight=weights)), 6
        ),
        "roc_auc": round(float(roc_auc_score(labels, probabilities, sample_weight=weights)), 6),
    }


def latest_position_indices(rows: List[Dict[str, Any]], indices: np.ndarray) -> np.ndarray:
    latest: Dict[Tuple[str, str], Tuple[int, int]] = {}
    for index in indices:
        row = rows[index]
        key = (row["game_id"], row["perspective"])
        candidate = (int(row["turn"]), int(index))
        if key not in latest or candidate[0] > latest[key][0]:
            latest[key] = candidate
    return np.asarray([item[1] for item in latest.values()])


def export_tree(tree: Any) -> Dict[str, Any]:
    raw = tree.tree_
    return {
        "children_left": raw.children_left.astype(int).tolist(),
        "children_right": raw.children_right.astype(int).tolist(),
        "feature": raw.feature.astype(int).tolist(),
        "threshold": [round(float(value), 12) for value in raw.threshold],
        "value": [round(float(value), 12) for value in raw.value[:, 0, 0]],
    }


def exported_probabilities(artifact: Dict[str, Any], vectors: np.ndarray) -> np.ndarray:
    raw = np.full(len(vectors), artifact["base_raw_score"], dtype=np.float64)
    for tree in artifact["trees"]:
        values = np.empty(len(vectors), dtype=np.float64)
        for row_index, vector in enumerate(vectors):
            node = 0
            while tree["children_left"][node] != -1:
                feature = tree["feature"][node]
                node = (
                    tree["children_left"][node]
                    if vector[feature] <= tree["threshold"][node]
                    else tree["children_right"][node]
                )
            values[row_index] = tree["value"][node]
        raw += artifact["learning_rate"] * values
    calibration = artifact["calibration"]
    return sigmoid(calibration["scale"] * raw + calibration["intercept"])


def main() -> None:
    args = parse_args()
    feature_names, rows, vectors, labels = load_dataset(args.dataset)
    splits = chronological_split(rows)
    weights = {name: game_balanced_weights(rows, indices) for name, indices in splits.items()}

    candidates = [
        {"n_estimators": 120, "max_depth": 2, "learning_rate": 0.05, "min_samples_leaf": 30},
        {"n_estimators": 160, "max_depth": 3, "learning_rate": 0.05, "min_samples_leaf": 30},
        {"n_estimators": 220, "max_depth": 2, "learning_rate": 0.04, "min_samples_leaf": 20},
        {"n_estimators": 200, "max_depth": 3, "learning_rate": 0.03, "min_samples_leaf": 20},
    ]
    trained: List[Tuple[float, Dict[str, Any], GradientBoostingClassifier]] = []
    train_indices = splits["train"]
    validation_indices = splits["validation"]
    for parameters in candidates:
        model = GradientBoostingClassifier(
            **parameters,
            loss="log_loss",
            subsample=0.85,
            random_state=args.random_state,
        )
        model.fit(
            vectors[train_indices],
            labels[train_indices],
            sample_weight=weights["train"],
        )
        validation_probability = model.predict_proba(vectors[validation_indices])[:, 1]
        score = float(
            log_loss(
                labels[validation_indices],
                validation_probability,
                sample_weight=weights["validation"],
            )
        )
        print(json.dumps({"candidate": parameters, "validation_log_loss": round(score, 6)}))
        trained.append((score, parameters, model))
    _, best_parameters, model = min(trained, key=lambda item: item[0])

    validation_raw_probability = model.predict_proba(vectors[validation_indices])[:, 1]
    calibrator = LogisticRegression(random_state=args.random_state)
    calibrator.fit(
        safe_logit(validation_raw_probability).reshape(-1, 1),
        labels[validation_indices],
        sample_weight=weights["validation"],
    )
    calibration_scale = float(calibrator.coef_[0, 0])
    calibration_intercept = float(calibrator.intercept_[0])

    split_metrics: Dict[str, Any] = {}
    all_probabilities: Dict[str, np.ndarray] = {}
    for name, indices in splits.items():
        raw_probability = model.predict_proba(vectors[indices])[:, 1]
        probability = sigmoid(calibration_scale * safe_logit(raw_probability) + calibration_intercept)
        all_probabilities[name] = probability
        split_metrics[name] = metrics(labels[indices], probability, weights[name])
        latest = latest_position_indices(rows, indices)
        probability_by_index = {int(index): probability[offset] for offset, index in enumerate(indices)}
        latest_probability = np.asarray([probability_by_index[int(index)] for index in latest])
        latest_weights = game_balanced_weights(rows, latest)
        split_metrics[name]["latest_position"] = metrics(
            labels[latest], latest_probability, latest_weights
        )
        split_metrics[name]["games"] = len({rows[index]["game_id"] for index in indices})
        split_metrics[name]["samples"] = len(indices)

    priors = model.init_.class_prior_
    base_raw_score = math.log(float(priors[1]) / float(priors[0]))
    importances = sorted(
        zip(feature_names, model.feature_importances_), key=lambda item: item[1], reverse=True
    )
    artifact = {
        "format": "ghq-gradient-boosted-value-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "feature_names": feature_names,
        "base_raw_score": base_raw_score,
        "learning_rate": float(model.learning_rate),
        "calibration": {
            "kind": "platt",
            "scale": calibration_scale,
            "intercept": calibration_intercept,
        },
        "trees": [export_tree(stage[0]) for stage in model.estimators_],
        "metadata": {
            "target": "probability that the perspective player eventually wins",
            "eligible_outcomes": sorted({row["outcome_reason"] for row in rows}),
            "split": "chronological 70/15/15 by whole game",
            "hyperparameters": best_parameters,
            "metrics": split_metrics,
            "feature_importance": [
                {"feature": name, "importance": round(float(importance), 8)}
                for name, importance in importances[:25]
            ],
            "dataset_sha256": hashlib.sha256(args.dataset.read_bytes()).hexdigest(),
            "data_start": min(row["created_at"] for row in rows),
            "data_end": max(row["created_at"] for row in rows),
        },
    }
    test_indices = splits["test"]
    sample_size = min(250, len(test_indices))
    exported = exported_probabilities(artifact, vectors[test_indices[:sample_size]])
    reference = all_probabilities["test"][:sample_size]
    max_export_error = float(np.max(np.abs(exported - reference)))
    if max_export_error > 1e-9:
        raise RuntimeError(f"exported tree inference differs by {max_export_error}")

    report = {
        "format": artifact["format"],
        "best_hyperparameters": best_parameters,
        "metrics": split_metrics,
        "feature_importance": artifact["metadata"]["feature_importance"],
        "export_parity_max_absolute_error": max_export_error,
        "feature_count": len(feature_names),
        "tree_count": len(artifact["trees"]),
        "games": len({row["game_id"] for row in rows}),
        "positions": len(rows) // 2,
        "samples": len(rows),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, separators=(",", ":")), encoding="utf-8")
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

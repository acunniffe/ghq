#!/usr/bin/env python3
"""Explainable, headless GHQ search engine.

Search depth is measured in complete player turns. A turn can contain automatic
captures followed by up to three player actions, matching public/engine.py.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "public"))

import engine  # noqa: E402


PIECE_VALUES = {
    engine.HQ: 100.0,
    engine.INFANTRY: 1.0,
    engine.ARMORED_INFANTRY: 3.0,
    engine.AIRBORNE_INFANTRY: 5.0,
    engine.ARTILLERY: 3.0,
    engine.ARMORED_ARTILLERY: 5.0,
    engine.HEAVY_ARTILLERY: 6.0,
}
UNIT_TYPES = tuple(PIECE_VALUES)
NON_HQ_TYPES = tuple(piece for piece in UNIT_TYPES if piece != engine.HQ)
ARTILLERY_TYPES = (engine.ARTILLERY, engine.ARMORED_ARTILLERY, engine.HEAVY_ARTILLERY)

# Component weights are intentionally editable. A personality changes priorities,
# not game rules or the underlying feature definitions.
PERSONALITIES: Dict[str, Dict[str, float]] = {
    "balanced": {},
    "fortress": {
        "support": 1.45,
        "overextension": 1.40,
        "artillery_formation": 1.25,
        "hq_safety": 1.35,
        "mobility": 0.80,
    },
    "mobile": {
        "material": 0.90,
        "support": 0.85,
        "mobility": 1.60,
        "open_board_armored_infantry": 1.55,
        "artillery_formation": 0.70,
    },
    "artillery": {
        "artillery_formation": 1.55,
        "artillery_pressure": 1.45,
        "support": 1.20,
        "open_board_armored_infantry": 0.70,
    },
}

BASE_WEIGHTS = {
    "material": 1.0,
    "support": 1.0,
    "overextension": 1.0,
    "artillery_formation": 1.0,
    "artillery_pressure": 1.0,
    "mobility": 1.0,
    "open_board_armored_infantry": 1.0,
    "airborne_survival": 1.0,
    "hq_safety": 1.0,
}

MATE_SCORE = 1_000_000.0


def squares(mask: int) -> List[int]:
    return list(engine.scan_reversed(mask))


def chebyshev(a: int, b: int) -> int:
    return max(abs(engine.square_file(a) - engine.square_file(b)), abs(engine.square_rank(a) - engine.square_rank(b)))


def color_name(color: bool) -> str:
    return "blue" if color == engine.BLUE else "red"


def material_for(board: engine.BaseBoard, color: bool) -> float:
    total = 0.0
    for piece_type, value in PIECE_VALUES.items():
        total += value * engine.popcount(board.pieces_mask(piece_type, color))
        if piece_type != engine.HQ:
            total += value * board.get_reserve_count(piece_type, color)
    return total


def surviving_non_hq_count(board: engine.BaseBoard) -> int:
    on_board = engine.popcount(board.occupied & ~board.hq)
    in_reserve = sum(
        board.get_reserve_count(piece_type, color)
        for color in (engine.RED, engine.BLUE)
        for piece_type in NON_HQ_TYPES
    )
    return on_board + in_reserve


def support_penalty(board: engine.BaseBoard, color: bool) -> float:
    friendly = squares(board.occupied_co[color] & ~board.hq)
    penalty = 0.0
    for square in friendly:
        piece_type = board.piece_type_at(square)
        if piece_type is None:
            continue
        # Airborne survival is modeled separately. Applying generic support
        # and overextension penalties as well would double-count its risk and
        # can perversely value leaving it trapped over actually capturing it.
        if piece_type == engine.AIRBORNE_INFANTRY:
            continue
        neighbours = [other for other in friendly if other != square]
        nearest = min((chebyshev(square, other) for other in neighbours), default=8)
        value = PIECE_VALUES[piece_type]
        if nearest > 1:
            penalty += 0.50 * value
        if nearest >= 3:
            penalty += 0.25 * value
    return penalty


def airborne_survival_penalty(board: engine.BaseBoard, color: bool) -> float:
    """Penalize committed paratroopers that are deep, unsupported, or engaged.

    A staged paratrooper on its home rank is deliberately held as a threat and
    receives no penalty. Once deployed, its nominal material value is only
    real if it has a plausible extraction route. Engagement is especially
    dangerous because the opponent can often use the other two actions of the
    turn to clear a capture lane and take it.
    """
    penalty = 0.0
    home_rank = 0 if color == engine.RED else 7
    friendly_support = board.occupied_co[color] & ~board.hq
    enemy_infantry = board.occupied_co[not color] & (
        board.infantry | board.armored_infantry | board.airborne_infantry
    )
    for square in squares(board.airborne_infantry & board.occupied_co[color]):
        rank = engine.square_rank(square)
        if rank == home_rank:
            continue
        distance_home = abs(rank - home_rank)
        adjacent = engine.BB_ADJACENT_SQUARES[square]
        penalty += 0.20 * distance_home
        if not adjacent & friendly_support:
            penalty += 1.25
        if adjacent & enemy_infantry:
            # Engagement is a major warning, but not itself a capture. Search
            # must still prove the remaining setup actions that take the unit.
            penalty += 2.0
    return penalty


def overextension_penalty(board: engine.BaseBoard, color: bool) -> float:
    units = squares(board.occupied_co[color] & ~board.hq & ~board.airborne_infantry)
    if not units:
        return 0.0
    rank_power = [0.0] * 8
    for square in units:
        piece_type = board.piece_type_at(square)
        if piece_type is not None:
            rank_power[engine.square_rank(square)] += PIECE_VALUES[piece_type]
    anchor = max(range(8), key=lambda rank: rank_power[rank])
    penalty = 0.0
    for square in units:
        advance = engine.square_rank(square) - anchor if color == engine.RED else anchor - engine.square_rank(square)
        if advance >= 2:
            piece_type = board.piece_type_at(square)
            if piece_type is not None:
                penalty += 0.35 * PIECE_VALUES[piece_type] * (advance - 1)
    return penalty


def artillery_formation(board: engine.BaseBoard, color: bool) -> float:
    artillery_mask = board.occupied_co[color] & (board.artillery | board.armored_artillery | board.heavy_artillery)
    guns = squares(artillery_mask)
    score = 0.0
    for index, a in enumerate(guns):
        for b in guns[index + 1 :]:
            if chebyshev(a, b) == 1:
                score += 0.35
    # Reward the user's preferred battery: heavy artillery between two guns.
    for heavy in squares(artillery_mask & board.heavy_artillery):
        hf, hr = engine.square_file(heavy), engine.square_rank(heavy)
        same_rank = [g for g in guns if g != heavy and engine.square_rank(g) == hr]
        same_file = [g for g in guns if g != heavy and engine.square_file(g) == hf]
        if any(engine.square_file(g) < hf for g in same_rank) and any(engine.square_file(g) > hf for g in same_rank):
            score += 1.25
        if any(engine.square_rank(g) < hr for g in same_file) and any(engine.square_rank(g) > hr for g in same_file):
            score += 1.25
    return score


def artillery_pressure(board: engine.BaseBoard, color: bool) -> float:
    controlled = board.get_bombarded_squares(color)
    enemy_targets = controlled & board.occupied_co[not color]
    target_value = 0.0
    for square in squares(enemy_targets):
        piece_type = board.piece_type_at(square)
        if piece_type is not None:
            target_value += 0.22 * PIECE_VALUES[piece_type]
    return target_value + 0.025 * engine.popcount(controlled)


def action_mobility(board: engine.BaseBoard, color: bool) -> float:
    probe = board.copy()
    probe.turn = color
    probe.turn_moves = 0
    probe.turn_auto_moves = 0
    probe.turn_pieces = engine.BB_EMPTY
    probe.did_offer_draw = False
    probe.did_accept_draw = False
    probe._clear_free_captures()
    list(probe._generate_free_captures(color))
    return math.log1p(sum(1 for move in probe.generate_legal_moves() if move.name != "Skip"))


def hq_safety(board: engine.BaseBoard, color: bool) -> float:
    hq = board.hq & board.occupied_co[color]
    if not hq:
        return -MATE_SCORE
    score = 0.0
    if hq & board.get_bombarded_squares(not color):
        score -= 40.0
    hq_square = squares(hq)[0]
    enemy_infantry = board.occupied_co[not color] & (board.infantry | board.armored_infantry | board.airborne_infantry)
    score -= 1.5 * engine.popcount(engine.BB_ADJACENT_SQUARES[hq_square] & enemy_infantry)
    return score


def evaluation_breakdown(board: engine.BaseBoard, personality: str = "balanced") -> Dict[str, Any]:
    if personality not in PERSONALITIES:
        raise ValueError(f"unknown personality: {personality}")

    surviving_units = surviving_non_hq_count(board)
    raw = {
        "material": material_for(board, engine.RED) - material_for(board, engine.BLUE),
        "support": support_penalty(board, engine.BLUE) - support_penalty(board, engine.RED),
        "overextension": overextension_penalty(board, engine.BLUE) - overextension_penalty(board, engine.RED),
        "artillery_formation": artillery_formation(board, engine.RED) - artillery_formation(board, engine.BLUE),
        "artillery_pressure": artillery_pressure(board, engine.RED) - artillery_pressure(board, engine.BLUE),
        "mobility": 0.30 * (action_mobility(board, engine.RED) - action_mobility(board, engine.BLUE)),
        "open_board_armored_infantry": 0.0,
        "airborne_survival": airborne_survival_penalty(board, engine.BLUE)
        - airborne_survival_penalty(board, engine.RED),
        "hq_safety": hq_safety(board, engine.RED) - hq_safety(board, engine.BLUE),
    }
    if surviving_units <= 18:
        raw["open_board_armored_infantry"] = 0.65 * (
            engine.popcount(board.armored_infantry & board.occupied_co[engine.RED])
            - engine.popcount(board.armored_infantry & board.occupied_co[engine.BLUE])
        )

    profile = PERSONALITIES[personality]
    weights = {name: BASE_WEIGHTS[name] * profile.get(name, 1.0) for name in raw}
    weighted = {name: raw[name] * weights[name] for name in raw}
    return {
        "perspective": "red-positive",
        "personality": personality,
        "components": {key: round(value, 4) for key, value in raw.items()},
        "weights": weights,
        "weighted_components": {key: round(value, 4) for key, value in weighted.items()},
        "total_red": round(sum(weighted.values()), 4),
    }


class SearchTimeout(Exception):
    pass


@dataclass
class SearchResult:
    score: float
    pv: List[engine.Move]


class Searcher:
    def __init__(self, personality: str, time_ms: int, beam_width: int) -> None:
        self.personality = personality
        self.deadline = time.monotonic() + max(1, time_ms) / 1000.0
        self.beam_width = max(1, beam_width)
        self.nodes = 0
        self.table: Dict[Tuple[str, int], SearchResult] = {}

    def check_time(self) -> None:
        self.nodes += 1
        if self.nodes % 128 == 0 and time.monotonic() >= self.deadline:
            raise SearchTimeout

    def terminal_score(self, board: engine.BaseBoard, turns_left: int) -> Optional[float]:
        outcome = board.outcome()
        if outcome is None:
            return None
        if outcome.winner is None:
            return 0.0
        tempo = max(0, turns_left)
        return (MATE_SCORE + tempo) if outcome.winner == engine.RED else -(MATE_SCORE + tempo)

    def static_score(self, board: engine.BaseBoard) -> float:
        return float(evaluation_breakdown(board, self.personality)["total_red"])

    def move_priority(self, board: engine.BaseBoard, move: engine.Move) -> float:
        if move.name == "AutoCapture":
            target = board.piece_type_at(move.capture_preference) if move.capture_preference is not None else None
            return 10000.0 + 100.0 * PIECE_VALUES.get(target, 0.0)
        if move.capture_preference is not None:
            target = board.piece_type_at(move.capture_preference)
            return 5000.0 + 100.0 * PIECE_VALUES.get(target, 0.0)
        if move.name == "Skip":
            return -10000.0
        priority = 0.0
        piece_type = move.unit_type if move.name == "Reinforce" else board.piece_type_at(move.from_square)
        infantry_types = (
            engine.INFANTRY,
            engine.ARMORED_INFANTRY,
            engine.AIRBORNE_INFANTRY,
        )
        enemy_airborne = board.airborne_infantry & board.occupied_co[not board.turn]
        if (
            piece_type in infantry_types
            and move.to_square is not None
            and engine.BB_ADJACENT_SQUARES[move.to_square] & enemy_airborne
        ):
            # Quiet moves and reinforcements that engage an enemy paratrooper
            # are tactical setup moves. Keep them inside the beam so a later
            # action in the same turn can complete the capture.
            priority += 4500.0
        if (
            piece_type in ARTILLERY_TYPES
            and move.from_square is not None
            and move.to_square is not None
            and move.from_square != move.to_square
            and engine.BB_ADJACENT_SQUARES[move.from_square] & enemy_airborne
        ):
            # Vacating an artillery square can open the lane another infantry
            # needs in order to take an already-engaged paratrooper.
            priority += 4000.0
        if piece_type == engine.ARMORED_INFANTRY:
            priority += 20.0
        elif piece_type in ARTILLERY_TYPES:
            priority += 10.0
        if move.name == "MoveAndOrient":
            priority += 5.0
        return priority

    def ordered_moves(self, board: engine.BaseBoard) -> List[engine.Move]:
        moves = list(board.generate_legal_moves())
        moves.sort(key=lambda move: (-self.move_priority(board, move), move.uci()))
        if moves and all(move.name == "AutoCapture" for move in moves):
            return moves
        selected = moves[: self.beam_width]
        # Skipping is strategically meaningful: it prevents the bot from
        # spending a third action on a lateral/no-op move merely because Skip
        # sorts below every quiet action. Preserve it outside the normal beam.
        skip = next((move for move in moves if move.name == "Skip"), None)
        if skip is not None and skip not in selected:
            selected.append(skip)
        return selected

    def alphabeta(self, board: engine.BaseBoard, turns_left: int, alpha: float, beta: float) -> SearchResult:
        self.check_time()
        terminal = self.terminal_score(board, turns_left)
        if terminal is not None:
            return SearchResult(terminal, [])

        moves = self.ordered_moves(board)
        if not moves:
            return SearchResult(self.static_score(board), [])
        resolving_automatic = all(move.name == "AutoCapture" for move in moves)
        if turns_left <= 0 and not resolving_automatic:
            return SearchResult(self.static_score(board), [])

        key = (board.serialize(), turns_left)
        cached = self.table.get(key)
        if cached is not None:
            return SearchResult(cached.score, list(cached.pv))

        maximizing = board.turn == engine.RED
        best = SearchResult(-math.inf if maximizing else math.inf, [])
        complete = True
        for move in moves:
            child = board.copy()
            previous_turn = child.turn
            child.push(move)
            child_depth = turns_left - 1 if child.turn != previous_turn else turns_left
            result = self.alphabeta(child, child_depth, alpha, beta)
            candidate = result.score
            if (maximizing and candidate > best.score) or (not maximizing and candidate < best.score):
                best = SearchResult(candidate, [move] + result.pv)
            if maximizing:
                alpha = max(alpha, best.score)
            else:
                beta = min(beta, best.score)
            if beta <= alpha:
                complete = False
                break
        if complete:
            self.table[key] = SearchResult(best.score, list(best.pv))
        return best


def greedy_complete_turn(board: engine.BaseBoard, personality: str) -> SearchResult:
    working = board.copy()
    original_turn = working.turn
    moves: List[engine.Move] = []
    while working.turn == original_turn and not working.is_game_over():
        legal = list(working.generate_legal_moves())
        if not legal:
            break
        candidates: List[Tuple[float, str, engine.Move]] = []
        for move in legal:
            child = working.copy()
            child.push(move)
            score = float(evaluation_breakdown(child, personality)["total_red"])
            candidates.append((score, move.uci(), move))
        chosen = (max(candidates, key=lambda item: (item[0], item[1])) if original_turn == engine.RED else min(candidates, key=lambda item: (item[0], item[1])))[2]
        moves.append(chosen)
        working.push(chosen)
    return SearchResult(float(evaluation_breakdown(working, personality)["total_red"]), moves)


def first_turn_from_pv(board: engine.BaseBoard, pv: Sequence[engine.Move]) -> Tuple[List[engine.Move], engine.BaseBoard]:
    working = board.copy()
    original_turn = working.turn
    selected: List[engine.Move] = []
    for move in pv:
        if working.turn != original_turn:
            break
        selected.append(move)
        working.push(move)
    return selected, working


def search(board: engine.BaseBoard, personality: str, time_ms: int, max_depth: int, beam_width: int) -> Dict[str, Any]:
    started = time.monotonic()
    searcher = Searcher(personality, time_ms, beam_width)
    best: Optional[SearchResult] = None
    completed_depth = 0
    timed_out = False
    for depth in range(1, max(1, max_depth) + 1):
        try:
            iteration = searcher.alphabeta(board, depth, -math.inf, math.inf)
        except SearchTimeout:
            timed_out = True
            break
        best = iteration
        completed_depth = depth
        if abs(iteration.score) >= MATE_SCORE:
            break

    if best is None:
        best = greedy_complete_turn(board, personality)
    first_turn, resulting_board = first_turn_from_pv(board, best.pv)
    if not first_turn and not board.is_game_over():
        fallback = greedy_complete_turn(board, personality)
        first_turn, resulting_board = first_turn_from_pv(board, fallback.pv)
        best = fallback

    elapsed_ms = (time.monotonic() - started) * 1000.0
    automatic = [move.uci() for move in first_turn if move.name == "AutoCapture"]
    actions = [move.uci() for move in first_turn if move.name != "AutoCapture"]
    root_eval = evaluation_breakdown(board, personality)
    resulting_eval = evaluation_breakdown(resulting_board, personality)
    current_player_score = best.score if board.turn == engine.RED else -best.score
    return {
        "input_fen": board.board_fen(),
        "side_to_move": color_name(board.turn),
        "best_turn": {
            "automatic_captures": automatic,
            "actions": actions,
            "all_moves": [move.uci() for move in first_turn],
            "resulting_fen": resulting_board.board_fen(),
        },
        "principal_variation": [move.uci() for move in best.pv],
        "score": {
            "current_player": round(current_player_score, 4),
            "red": round(best.score, 4),
        },
        "search": {
            "completed_depth_in_turns": completed_depth,
            "requested_depth_in_turns": max_depth,
            "beam_width_per_action": beam_width,
            "nodes": searcher.nodes,
            "elapsed_ms": round(elapsed_ms, 2),
            "timed_out": timed_out,
            "approximate": True,
        },
        "evaluation": {
            "before": root_eval,
            "after_best_turn": resulting_eval,
        },
    }


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fen", default=engine.STARTING_FEN, help="GHQ FEN (defaults to the starting position)")
    parser.add_argument("--time-ms", type=int, default=2000, help="search budget in milliseconds")
    parser.add_argument("--max-depth", type=int, default=2, help="maximum search depth in complete player turns")
    parser.add_argument("--beam-width", type=int, default=12, help="maximum candidate actions retained at each node")
    parser.add_argument("--personality", choices=sorted(PERSONALITIES), default="balanced")
    parser.add_argument("--compact", action="store_true", help="emit compact JSON")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    try:
        board = engine.BaseBoard(args.fen)
        result = search(board, args.personality, args.time_ms, args.max_depth, args.beam_width)
    except (ValueError, AssertionError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=None if args.compact else 2, sort_keys=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

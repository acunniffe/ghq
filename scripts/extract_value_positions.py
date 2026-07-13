#!/usr/bin/env python3
"""Reconstruct complete-turn GHQ positions from a Games_rows.csv export."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Iterable, List


ELIGIBLE_REASONS = {"by HQ capture", "by resignation"}
RESERVE_TYPES = {
    "INFANTRY",
    "ARMORED_INFANTRY",
    "AIRBORNE_INFANTRY",
    "ARTILLERY",
    "ARMORED_ARTILLERY",
    "HEAVY_ARTILLERY",
}


class ReplayError(ValueError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--games-csv", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--minimum-turns", type=int, default=8)
    return parser.parse_args()


def is_coordinate(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and all(isinstance(part, int) and 0 <= part < 8 for part in value)
    )


def committed_turns(log: Iterable[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
    """Resolve boardgame.io undo/redo history into the actions committed by Skip."""
    done: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    redo: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    committed: Dict[int, List[Dict[str, Any]]] = {}
    for entry in log:
        turn = entry.get("turn")
        if not isinstance(turn, int):
            continue
        action = entry.get("action") or {}
        payload = action.get("payload") or {}
        if action.get("type") == "MAKE_MOVE":
            if payload.get("type") == "Skip":
                committed[turn] = deepcopy(done[turn])
            elif payload.get("type") not in {"Resign", "AcceptDraw", "OfferDraw"}:
                done[turn].append(deepcopy(payload))
                redo[turn].clear()
        elif action.get("type") == "UNDO":
            if done[turn]:
                redo[turn].append(done[turn].pop())
        elif action.get("type") == "REDO":
            if redo[turn]:
                done[turn].append(redo[turn].pop())
    return committed


def remove_at(board: List[List[Any]], coordinate: Any) -> None:
    if not is_coordinate(coordinate):
        return
    row, column = coordinate
    board[row][column] = None


def apply_move(
    board: List[List[Any]],
    red_reserve: Dict[str, int],
    blue_reserve: Dict[str, int],
    payload: Dict[str, Any],
) -> None:
    move_type = payload.get("type")
    args = payload.get("args") or []
    player_id = str(payload.get("playerID"))
    if move_type in {"Move", "MoveAndOrient"}:
        if len(args) < 2 or not is_coordinate(args[0]) or not is_coordinate(args[1]):
            raise ReplayError(f"invalid {move_type} coordinates")
        from_row, from_column = args[0]
        to_row, to_column = args[1]
        piece = board[from_row][from_column]
        if piece is None:
            raise ReplayError(f"empty source at {args[0]}")
        # Artillery can rotate without changing squares. Clearing the source
        # after assigning the destination would delete an in-place rotation.
        if (from_row, from_column) != (to_row, to_column):
            board[to_row][to_column] = piece
            board[from_row][from_column] = None
        if move_type == "MoveAndOrient" and len(args) > 2 and args[2] is not None:
            piece["orientation"] = int(args[2])
        if move_type == "Move" and len(args) > 2:
            remove_at(board, args[2])
        return
    if move_type == "Reinforce":
        if len(args) < 2 or args[0] not in RESERVE_TYPES or not is_coordinate(args[1]):
            raise ReplayError("invalid reinforcement")
        unit_type = args[0]
        player = "RED" if player_id == "0" else "BLUE"
        reserve = red_reserve if player == "RED" else blue_reserve
        if reserve.get(unit_type, 0) <= 0:
            raise ReplayError(f"empty {player} {unit_type} reserve")
        reserve[unit_type] -= 1
        row, column = args[1]
        piece = {"type": unit_type, "player": player}
        if "ARTILLERY" in unit_type:
            piece["orientation"] = 0 if player == "RED" else 180
        board[row][column] = piece
        if len(args) > 2:
            remove_at(board, args[2])
        return
    if move_type not in {"Skip", None}:
        raise ReplayError(f"unsupported move type {move_type}")


def normalized_board(board: Any) -> Any:
    """Remove irrelevant object-key differences before reconciliation."""
    result = deepcopy(board)
    for rank in result:
        for piece in rank:
            if piece is not None and "orientation" in piece and piece["orientation"] is None:
                del piece["orientation"]
    return result


def extract_game(row: Dict[str, str], minimum_turns: int) -> List[Dict[str, Any]]:
    gameover = json.loads(row.get("gameover") or "null")
    if not isinstance(gameover, dict):
        return []
    winner = gameover.get("winner")
    reason = gameover.get("reason")
    if gameover.get("status") != "WIN" or winner not in {"RED", "BLUE"}:
        return []
    if reason not in ELIGIBLE_REASONS:
        return []

    initial = json.loads(row["initialState"])
    final = json.loads(row["state"])
    log = json.loads(row["log"])
    initial_g = initial["G"]
    final_g = final["G"]
    board = deepcopy(initial_g["board"])
    red_reserve = deepcopy(initial_g["redReserve"])
    blue_reserve = deepcopy(initial_g["blueReserve"])
    captures_by_turn: Dict[int, List[Any]] = defaultdict(list)
    for item in final_g.get("historyLog") or []:
        turn = item.get("turn")
        if not isinstance(turn, int):
            continue
        for capture in item.get("captured") or []:
            captures_by_turn[turn].append(capture.get("coordinate"))

    snapshots: List[Dict[str, Any]] = []
    turns = committed_turns(log)
    for turn, actions in sorted(turns.items()):
        for coordinate in captures_by_turn.get(turn, []):
            remove_at(board, coordinate)
        player_ids = {
            str(payload.get("playerID"))
            for payload in actions
            if payload.get("playerID") is not None
        }
        if len(player_ids) > 1:
            raise ReplayError(f"multiple players on turn {turn}")
        player_id = next(iter(player_ids), "0" if turn % 2 else "1")
        for payload in actions:
            apply_move(board, red_reserve, blue_reserve, payload)
        next_player = "BLUE" if player_id == "0" else "RED"
        snapshots.append(
            {
                "type": "position",
                "game_id": row["id"],
                "created_at": row["createdAt"],
                "outcome_reason": reason,
                "winner": winner,
                "turn": turn,
                "current_player": next_player,
                "board": deepcopy(board),
                "red_reserve": deepcopy(red_reserve),
                "blue_reserve": deepcopy(blue_reserve),
            }
        )

    if len(snapshots) < minimum_turns:
        return []
    # A resignation has no terminal board mutation, so this is a strong replay
    # integrity check. HQ-capture games end without a final Skip and therefore
    # intentionally stop one partial turn before the stored final board.
    if reason == "by resignation" and normalized_board(board) != normalized_board(final_g["board"]):
        raise ReplayError("reconstructed resignation board does not match final board")
    return snapshots


def main() -> None:
    args = parse_args()
    csv.field_size_limit(300_000_000)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    summary = {
        "rows": 0,
        "eligible_games": 0,
        "positions": 0,
        "replay_errors": 0,
        "error_examples": [],
    }
    with args.games_csv.open(newline="", encoding="utf-8") as source, args.output.open(
        "w", encoding="utf-8"
    ) as output:
        for row in csv.DictReader(source):
            summary["rows"] += 1
            try:
                positions = extract_game(row, args.minimum_turns)
            except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
                summary["replay_errors"] += 1
                if len(summary["error_examples"]) < 10:
                    summary["error_examples"].append({"game_id": row.get("id"), "error": str(error)})
                continue
            if not positions:
                continue
            summary["eligible_games"] += 1
            summary["positions"] += len(positions)
            for position in positions:
                output.write(json.dumps(position, separators=(",", ":")) + "\n")
    print(json.dumps(summary, indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()

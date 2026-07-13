import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "extract_value_positions.py"
SPEC = importlib.util.spec_from_file_location("extract_value_positions", SCRIPT)
assert SPEC and SPEC.loader
extractor = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = extractor
SPEC.loader.exec_module(extractor)


def empty_board():
    return [[None for _ in range(8)] for _ in range(8)]


def reserves():
    return {
        "INFANTRY": 1,
        "ARMORED_INFANTRY": 0,
        "AIRBORNE_INFANTRY": 0,
        "ARTILLERY": 1,
        "ARMORED_ARTILLERY": 0,
        "HEAVY_ARTILLERY": 0,
    }


class ValuePositionReplayTests(unittest.TestCase):
    def test_in_place_artillery_rotation_preserves_piece(self):
        board = empty_board()
        board[4][4] = {"type": "ARTILLERY", "player": "RED", "orientation": 0}
        extractor.apply_move(
            board,
            reserves(),
            reserves(),
            {
                "type": "MoveAndOrient",
                "args": [[4, 4], [4, 4], 90],
                "playerID": "0",
            },
        )
        self.assertEqual(board[4][4]["orientation"], 90)

    def test_undo_actions_do_not_enter_committed_turn(self):
        log = [
            {
                "turn": 1,
                "action": {
                    "type": "MAKE_MOVE",
                    "payload": {
                        "type": "Reinforce",
                        "args": ["INFANTRY", [7, 0]],
                        "playerID": "0",
                    },
                },
            },
            {"turn": 1, "action": {"type": "UNDO", "payload": {}}},
            {
                "turn": 1,
                "action": {
                    "type": "MAKE_MOVE",
                    "payload": {"type": "Skip", "args": [], "playerID": "0"},
                },
            },
        ]
        self.assertEqual(extractor.committed_turns(log)[1], [])


if __name__ == "__main__":
    unittest.main()

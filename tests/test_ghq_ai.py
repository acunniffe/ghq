import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ghq_ai", ROOT / "scripts" / "ghq_ai.py")
assert SPEC and SPEC.loader
ghq_ai = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = ghq_ai
SPEC.loader.exec_module(ghq_ai)
engine = ghq_ai.engine
PARATROOPER_TRAP_FEN = (
    "q3i3/1iif2f1/ir↓3r↓2/8/t↓r↓6/2f2R↑1I/3T↑H↑1I1/"
    "FR↑p1P1Q1 IIIII iiii r"
)
PARATROOPER_EXTRACTION_FEN = (
    "q2r↓4/ir↓i2r↘2/8/3h↘4/fi5P/6f1/3H↑I2p/"
    "1FR↑2T↗FQ IIIIIF iiiii b"
)
POST_EXTRACTION_PRESSURE_FEN = (
    "q2r↓4/ir↓i2r↘2/4h↘3/8/fi3f1P/5Ip1/3H↑2F1/"
    "1FR↑2T↗1Q IIIIIF iiiii r"
)
TURN_28_FORCED_MATE_FEN = (
    "q2r↓4/ir↓i2r↘2/8/3h↘4/fi5P/3FH↑1f1/4IF1p/"
    "2R↑2T↗1Q IIIIIF iiiii b"
)


class EvaluationTests(unittest.TestCase):
    def test_starting_position_is_symmetric(self):
        breakdown = ghq_ai.evaluation_breakdown(engine.BaseBoard())
        self.assertAlmostEqual(breakdown["total_red"], 0.0)
        self.assertAlmostEqual(
            sum(breakdown["weighted_components"].values()),
            breakdown["total_red"],
            places=3,
        )

    def test_personalities_change_weights_not_features(self):
        board = engine.BaseBoard()
        balanced = ghq_ai.evaluation_breakdown(board, "balanced")
        fortress = ghq_ai.evaluation_breakdown(board, "fortress")
        self.assertEqual(balanced["components"], fortress["components"])
        self.assertGreater(fortress["weights"]["support"], balanced["weights"]["support"])

    def test_starting_position_is_not_treated_as_open_endgame(self):
        board = engine.BaseBoard()
        board.remove_from_reserve(engine.ARMORED_INFANTRY, engine.BLUE)
        breakdown = ghq_ai.evaluation_breakdown(board)
        self.assertEqual(breakdown["components"]["open_board_armored_infantry"], 0.0)

    def test_engagement_increases_deployed_paratrooper_risk(self):
        board = engine.BaseBoard(PARATROOPER_TRAP_FEN)
        before = ghq_ai.airborne_survival_penalty(board, engine.BLUE)
        board.push(engine.Move.from_uci("rid1"))
        after = ghq_ai.airborne_survival_penalty(board, engine.BLUE)
        self.assertGreater(after, before)


class SearchTests(unittest.TestCase):
    def test_regression_trapped_paratrooper_capture_stays_inside_beam(self):
        """The c1 paratrooper cannot be valued as a clean armored trade.

        Red can deploy on d1 to engage it, vacate b1 with the artillery,
        then move the a1 armored infantry to b1 and capture c1.
        """
        board = engine.BaseBoard(PARATROOPER_TRAP_FEN)
        searcher = ghq_ai.Searcher("balanced", time_ms=2000, beam_width=6)

        self.assertIn("rid1", [move.uci() for move in searcher.ordered_moves(board)])
        for uci in ("rid1", "b1c2↑", "a1b1xc1"):
            move = engine.Move.from_uci(uci)
            self.assertIn(move, list(board.generate_legal_moves()))
            if uci == "b1c2↑":
                candidates = searcher.ordered_moves(board)
                move = next(
                    candidate
                    for candidate in candidates
                    if candidate.from_square == engine.parse_square("b1")
                    and candidate.to_square == engine.parse_square("c2")
                )
            elif uci != "rid1":
                self.assertIn(uci, [candidate.uci() for candidate in searcher.ordered_moves(board)])
            board.push(move)

        self.assertFalse(board.airborne_infantry & board.occupied_co[engine.BLUE])

    def test_skip_is_not_preserved_before_final_optional_action(self):
        searcher = ghq_ai.Searcher("balanced", time_ms=1000, beam_width=1)
        moves = searcher.ordered_moves(engine.BaseBoard())
        self.assertNotIn("skip", [move.uci() for move in moves])

    def test_artillery_orientations_do_not_crowd_out_destinations(self):
        board = engine.BaseBoard(PARATROOPER_EXTRACTION_FEN)
        searcher = ghq_ai.Searcher("balanced", time_ms=2000, beam_width=20)
        moves = searcher.ordered_moves(board)
        artillery_moves = [move for move in moves if move.from_square == engine.parse_square("d5")]
        destinations = [move.to_square for move in artillery_moves]
        self.assertEqual(len(destinations), len(set(destinations)))
        self.assertTrue(all(not searcher.points_toward_home(engine.BLUE, move.orientation) for move in artillery_moves))

    def test_distant_artillery_cannot_spend_action_only_rotating(self):
        board = engine.BaseBoard()
        searcher = ghq_ai.Searcher("balanced", time_ms=1000, beam_width=8)
        self.assertFalse(searcher.artillery_move_allowed(board, engine.Move.from_uci("g1g1→")))
        self.assertFalse(searcher.artillery_move_allowed(board, engine.Move.from_uci("g1g1↓")))
        self.assertTrue(searcher.artillery_move_allowed(board, engine.Move.from_uci("g1f1↑")))

    def test_quiet_unblock_and_paratrooper_extraction_stay_in_beam(self):
        board = engine.BaseBoard(PARATROOPER_EXTRACTION_FEN)
        searcher = ghq_ai.Searcher("balanced", time_ms=3000, beam_width=6)

        # Save the bombarded heavy artillery first.
        first = engine.Move.from_uci("d5e6↘")
        self.assertIn(first, list(board.generate_legal_moves()))
        board.push(first)

        # Moving the armored infantry quietly unlocks h2-g3 and must therefore
        # survive a narrow beam.
        self.assertIn("g3f4", [move.uci() for move in searcher.ordered_moves(board)])
        board.push(engine.Move.from_uci("g3f4"))
        self.assertIn("h2g3", [move.uci() for move in searcher.ordered_moves(board)])

    def test_complete_turn_generation_preserves_paratrooper_extraction(self):
        board = engine.BaseBoard(PARATROOPER_EXTRACTION_FEN)
        searcher = ghq_ai.Searcher("balanced", time_ms=5000, beam_width=6)
        turns = searcher.generate_turn_candidates(board)
        sequences = [[move.uci() for move in turn.moves] for turn in turns]
        self.assertTrue(
            any(
                "g3f4" in sequence
                and "h2g3" in sequence
                and sequence.index("g3f4") < sequence.index("h2g3")
                for sequence in sequences
            )
        )
        self.assertGreater(searcher.complete_turns_deduplicated, 0)

    def test_search_reports_best_found_when_it_prunes(self):
        result = ghq_ai.search(
            engine.BaseBoard(PARATROOPER_EXTRACTION_FEN),
            "balanced",
            time_ms=2500,
            max_depth=1,
            beam_width=6,
        )
        self.assertEqual(result["recommendation_label"], "best found")
        self.assertFalse(result["search"]["exhaustive_within_requested_horizon"])

    def test_forcing_artillery_pressure_displaces_empty_infantry_move(self):
        board = engine.BaseBoard(POST_EXTRACTION_PRESSURE_FEN)
        searcher = ghq_ai.Searcher("balanced", time_ms=2000, beam_width=6)
        moves = [move.uci() for move in searcher.ordered_moves(board)]
        self.assertIn("d2e1↗", moves)
        self.assertNotIn("b1b2", moves)

    def test_search_returns_a_complete_three_action_turn(self):
        board = engine.BaseBoard()
        result = ghq_ai.search(board, "balanced", time_ms=1200, max_depth=1, beam_width=8)
        moves = result["best_turn"]["all_moves"]
        actions = result["best_turn"]["actions"]
        self.assertLessEqual(len(actions), 3)
        self.assertGreater(len(actions), 0)

        replay = board.copy()
        for uci in moves:
            move = engine.Move.from_uci(uci)
            self.assertIn(move, list(replay.generate_legal_moves()))
            replay.push(move)
        self.assertNotEqual(replay.turn, board.turn)
        self.assertEqual(replay.board_fen(), result["best_turn"]["resulting_fen"])

    def test_search_takes_an_immediate_hq_capture(self):
        board = engine.BaseBoard("qI6/8/1I6/8/8/8/8/7Q - - r")
        result = ghq_ai.search(board, "balanced", time_ms=1000, max_depth=1, beam_width=8)
        self.assertEqual(result["best_turn"]["actions"], ["b6a7xa8"])
        self.assertGreaterEqual(result["score"]["red"], ghq_ai.MATE_SCORE)

    def test_search_finds_two_action_hq_combination(self):
        board = engine.BaseBoard(TURN_28_FORCED_MATE_FEN)
        result = ghq_ai.search(board, "balanced", time_ms=4000, max_depth=1, beam_width=6)
        self.assertEqual(result["best_turn"]["actions"], ["h2g1xf1", "g3h2xh1"])
        self.assertLessEqual(result["score"]["red"], -ghq_ai.MATE_SCORE)


if __name__ == "__main__":
    unittest.main()

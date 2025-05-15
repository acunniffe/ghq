import { describe, expect, it } from "@jest/globals";
import { getAllowedMoves } from "@/game/board-moves";
import { FENtoBoardState } from "../notation";
import { allowedMoveToUci } from "../notation-uci";

interface LegalMovesTest {
  description: string;
  boardFEN: string;
  expectedMovesUCI: string;
}

interface MakeMoveTest {
  description: string;
  boardFEN: string;
  moveUCI: string;
  expectedBoardFEN: string;
}

const LEGAL_MOVES_TESTS: LegalMovesTest[] = [
  {
    description: "initial board state",
    boardFEN: "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r",
    expectedMovesUCI:
      "ria1 rib1 ric1 rid1 rie1 rif1 rfa1 rfb1 rfc1 rfd1 rfe1 rff1 rpa1 rpb1 rpc1 rpd1 rpe1 rpf1 rra1 rrb1 rrc1 rrd1 rre1 rrf1 rta1 rtb1 rtc1 rtd1 rte1 rtf1 rha1 rhb1 rhc1 rhd1 rhe1 rhf1 f2e3 f2f3 f2g3 f2e2 f2e1 f2f1 g2f3 g2g3 g2h3 g2f1 h2g3 h2h3 g1f1↑ g1f1↗ g1f1→ g1f1↘ g1f1↓ g1f1↙ g1f1← g1f1↖ g1g1↗ g1g1→ g1g1↘ g1g1↓ g1g1↙ g1g1← g1g1↖",
  },
  {
    description: "airborne infantry capture",
    boardFEN: "q7/8/4h↓3/8/8/8/8/3P3Q - - r",
    expectedMovesUCI:
      "d1b8 d1c8 d1d8 d1e8 d1f8 d1g8 d1h8 d1a7 d1b7 d1c7 d1d7 d1e7 d1e7xe6 d1f7 d1g7 d1h7 d1a6 d1b6 d1c6 d1d6 d1d6xe6 d1f6 d1f6xe6 d1g6 d1h6 d1a5 d1b5 d1c5 d1d5 d1f5 d1g5 d1h5 d1a4 d1b4 d1c4 d1d4 d1f4 d1g4 d1h4 d1a3 d1b3 d1c3 d1d3 d1f3 d1g3 d1h3 d1a2 d1b2 d1c2 d1d2 d1e2 d1f2 d1g2 d1h2 d1a1 d1b1 d1c1 d1e1 d1f1 d1g1 h1g2 h1h2 h1g1",
  },
  {
    description: "infantry capture engaged infantry",
    boardFEN: "q7/8/8/3i4/3II3/8/8/7Q - - r",
    expectedMovesUCI:
      "d4c4 d4c3 d4d3 d4e3 e4e5 e4e5xd5 e4f5 e4f4 e4d3 e4e3 e4f3 h1g2 h1h2 h1g1",
  },
  {
    description: "infantry capture hq",
    boardFEN: "qI6/8/1I6/8/8/8/8/7Q - - r",
    expectedMovesUCI:
      "b8c8 b8a7 b8b7 b8c7 b6a7 b6a7xa8 b6b7 b6c7 b6a6 b6c6 b6a5 b6b5 b6c5 h1g2 h1h2 h1g1",
  },
  {
    description: "infantry in front of artillery",
    boardFEN: "q7/1r↓6/1I↑6/8/8/8/8/7Q IIIIIFFFPRRTH iiiiifffprrth r",
    expectedMovesUCI:
      "ria1 rib1 ric1 rid1 rie1 rif1 rig1 rfa1 rfb1 rfc1 rfd1 rfe1 rff1 rfg1 rpa1 rpb1 rpc1 rpd1 rpe1 rpf1 rpg1 rra1 rrb1 rrc1 rrd1 rre1 rrf1 rrg1 rta1 rtb1 rtc1 rtd1 rte1 rtf1 rtg1 rha1 rhb1 rhc1 rhd1 rhe1 rhf1 rhg1 b6a7 b6a7xb7 b6c7 b6c7xb7 b6a6 b6c6 b6a5 b6c5 h1g2 h1h2 h1g1",
  },
  {
    boardFEN: "8/8/1i6/2r↓5/1I6/8/8/8 - - r",
    description: "capture scenario #1",
    expectedMovesUCI: "b4a5 b4b5 b4a4 b4a3 b4b3",
  },
  {
    boardFEN: "8/8/1i6/r↓1r↓5/8/8/8/1P6 - - r",
    description: "capture scenario #2",
    expectedMovesUCI:
      "b1a8 b1b8 b1c8 b1d8 b1e8 b1f8 b1g8 b1h8 b1a7 b1b7 b1c7 b1d7 b1e7 b1f7 b1g7 b1h7 b1a6 b1c6 b1d6 b1e6 b1f6 b1g6 b1h6 b1b5 b1d5 b1d5xc5 b1e5 b1f5 b1g5 b1h5 b1b4 b1d4 b1e4 b1f4 b1g4 b1h4 b1b3 b1d3 b1e3 b1f3 b1g3 b1h3 b1a2 b1b2 b1c2 b1d2 b1e2 b1f2 b1g2 b1h2 b1a1 b1c1 b1d1 b1e1 b1f1 b1g1 b1h1",
  },
  {
    boardFEN: "8/8/1i6/1Ii5/8/8/8/1P6 - - r",
    description: "capture scenario #3",
    expectedMovesUCI:
      "b5a5 b5a4 b5b4 b1a8 b1b8 b1c8 b1d8 b1e8 b1f8 b1g8 b1h8 b1a7 b1b7 b1c7 b1d7 b1e7 b1f7 b1g7 b1h7 b1a6 b1c6 b1d6 b1e6 b1f6 b1g6 b1h6 b1a5 b1d5 b1e5 b1f5 b1g5 b1h5 b1a4 b1b4 b1c4 b1d4 b1e4 b1f4 b1g4 b1h4 b1a3 b1b3 b1c3 b1d3 b1e3 b1f3 b1g3 b1h3 b1a2 b1b2 b1c2 b1d2 b1e2 b1f2 b1g2 b1h2 b1a1 b1c1 b1d1 b1e1 b1f1 b1g1 b1h1",
  },
  {
    boardFEN: "8/8/1i6/1Ir↓5/2I5/8/8/1P6 - - r",
    description: "capture scenario #4",
    expectedMovesUCI:
      "b5a5 b5a4 b5b4 c4d5 c4d5xc5 c4b4 c4d4 c4b3 c4d3 b1a8 b1b8 b1c8 b1d8 b1e8 b1f8 b1g8 b1h8 b1a7 b1b7 b1b7xb6 b1c7 b1d7 b1e7 b1f7 b1g7 b1h7 b1a6 b1a6xb6 b1c6 b1c6xc5 b1c6xb6 b1d6 b1e6 b1f6 b1g6 b1h6 b1a5 b1d5 b1d5xc5 b1e5 b1f5 b1g5 b1h5 b1a4 b1b4 b1d4 b1e4 b1f4 b1g4 b1h4 b1a3 b1b3 b1d3 b1e3 b1f3 b1g3 b1h3 b1a2 b1b2 b1c2 b1d2 b1e2 b1f2 b1g2 b1h2 b1a1 b1c1 b1d1 b1e1 b1f1 b1g1 b1h1",
  },
  {
    boardFEN: "qr↓6/iii5/8/8/8/8/5III/4P1R↑Q - - r",
    description: "capture scenario #5",
    expectedMovesUCI:
      "f2e3 f2f3 f2g3 f2e2 f2f1 g2f3 g2g3 g2h3 g2f1 h2g3 h2h3 e1c8 e1d8 e1e8 e1f8 e1g8 e1h8 e1d7 e1e7 e1f7 e1g7 e1h7 e1a6 e1c6 e1d6 e1e6 e1f6 e1g6 e1h6 e1a5 e1b5 e1c5 e1d5 e1e5 e1f5 e1g5 e1h5 e1a4 e1b4 e1c4 e1d4 e1e4 e1f4 e1g4 e1h4 e1a3 e1b3 e1c3 e1d3 e1e3 e1f3 e1g3 e1h3 e1a2 e1b2 e1c2 e1d2 e1e2 e1a1 e1b1 e1c1 e1d1 e1f1 g1f1↑ g1f1↗ g1f1→ g1f1↘ g1f1↓ g1f1↙ g1f1← g1f1↖ g1g1↗ g1g1→ g1g1↘ g1g1↓ g1g1↙ g1g1← g1g1↖",
  },
  {
    boardFEN: "qr↓1p4/iii5/8/8/8/8/5III/6R↑Q - - r",
    description: "capture scenario #6",
    expectedMovesUCI:
      "f2e3 f2f3 f2g3 f2e2 f2e1 f2f1 g2f3 g2g3 g2h3 g2f1 h2g3 h2h3 g1f1↑ g1f1↗ g1f1→ g1f1↘ g1f1↓ g1f1↙ g1f1← g1f1↖ g1g1↗ g1g1→ g1g1↘ g1g1↓ g1g1↙ g1g1← g1g1↖",
  },
  {
    boardFEN: "8/1iI5/1I1I4/8/8/8/8/8 - - r",
    description: "capture scenario #7",
    expectedMovesUCI:
      "c7c8 c7d8 c7d7 c7c6 b6a6 b6c6 b6a5 b6b5 b6c5 d6d7 d6e7 d6c6 d6e6 d6c5 d6d5 d6e5",
  },
  {
    boardFEN: "8/1i6/8/1Ii5/8/8/8/8 - - r",
    description: "capture scenario #8",
    expectedMovesUCI: "b5a6 b5a5 b5a4 b5b4",
  },
  {
    boardFEN: "8/8/1iI5/1Ii1iI2/Ii1I4/8/8/8 - - r",
    description: "capture scenario #9",
    expectedMovesUCI:
      "c6c7 c6d7 c6d6 b5a5 f5f6 f5g6 f5g5 f5f4 f5g4 a4a5 a4a3 d4d5 d4d5xc5 d4d5xe5 d4c4 d4c4xc5 d4c4xb4 d4e4 d4e4xe5 d4c3 d4d3 d4e3",
  },
  {
    boardFEN: "8/8/1iI5/1IiI4/I1Ii4/1ii5/8/8 - - r",
    description: "capture scenario #10",
    expectedMovesUCI: "c6c7 c6d7 c6d6 b5a5 d5d6 d5e6 d5e5 a4a5 a4b4 a4a3",
  },
  {
    boardFEN: "8/2R↑5/1R↑6/3i4/8/8/8/8 - - r",
    description: "capture scenario #11",
    expectedMovesUCI:
      "c7b8↑ c7b8↗ c7b8→ c7b8↘ c7b8↓ c7b8↙ c7b8← c7b8↖ c7c8↑ c7c8↗ c7c8→ c7c8↘ c7c8↓ c7c8↙ c7c8← c7c8↖ c7d8↑ c7d8↗ c7d8→ c7d8↘ c7d8↓ c7d8↙ c7d8← c7d8↖ c7b7↑ c7b7↗ c7b7→ c7b7↘ c7b7↓ c7b7↙ c7b7← c7b7↖ c7d7↑ c7d7↗ c7d7→ c7d7↘ c7d7↓ c7d7↙ c7d7← c7d7↖ c7c6↑ c7c6↗ c7c6→ c7c6↘ c7c6↓ c7c6↙ c7c6← c7c6↖ c7d6↑ c7d6↗ c7d6→ c7d6↘ c7d6↓ c7d6↙ c7d6← c7d6↖ c7c7↗ c7c7→ c7c7↘ c7c7↓ c7c7↙ c7c7← c7c7↖ b6a7↑ b6a7↗ b6a7→ b6a7↘ b6a7↓ b6a7↙ b6a7← b6a7↖ b6b7↑ b6b7↗ b6b7→ b6b7↘ b6b7↓ b6b7↙ b6b7← b6b7↖ b6a6↑ b6a6↗ b6a6→ b6a6↘ b6a6↓ b6a6↙ b6a6← b6a6↖ b6c6↑ b6c6↗ b6c6→ b6c6↘ b6c6↓ b6c6↙ b6c6← b6c6↖ b6a5↑ b6a5↗ b6a5→ b6a5↘ b6a5↓ b6a5↙ b6a5← b6a5↖ b6b5↑ b6b5↗ b6b5→ b6b5↘ b6b5↓ b6b5↙ b6b5← b6b5↖ b6c5↑ b6c5↗ b6c5→ b6c5↘ b6c5↓ b6c5↙ b6c5← b6c5↖ b6b6↗ b6b6→ b6b6↘ b6b6↓ b6b6↙ b6b6← b6b6↖",
  },
  {
    boardFEN: "1p6/8/8/1Ii5/8/8/8/8 - - r",
    description: "capture scenario #12",
    expectedMovesUCI: "b5a6 b5b6 b5a5 b5a4 b5b4",
  },
  {
    boardFEN: "1f6/8/8/1Ii5/8/8/8/8 - - r",
    description: "capture scenario #13",
    expectedMovesUCI: "b5a6 b5b6 b5a5 b5a4 b5b4",
  },
  {
    boardFEN: "1f6/8/8/1Qi5/8/8/8/8 - - r",
    description: "capture scenario #14",
    expectedMovesUCI: "b5a6 b5b6 b5c6 b5a5 b5a4 b5b4 b5c4",
  },
  {
    boardFEN: "8/1i6/8/1Q6/8/8/8/8 - - r",
    description: "capture scenario #15",
    expectedMovesUCI: "b5a6 b5b6 b5c6 b5a5 b5c5 b5a4 b5b4 b5c4",
  },
  {
    boardFEN: "p7/8/8/8/8/8/6R↑1/7Q - - r",
    description: "capture scenario #16",
    expectedMovesUCI:
      "g2f3↑ g2f3↗ g2f3→ g2f3↘ g2f3↓ g2f3↙ g2f3← g2f3↖ g2g3↑ g2g3↗ g2g3→ g2g3↘ g2g3↓ g2g3↙ g2g3← g2g3↖ g2h3↑ g2h3↗ g2h3→ g2h3↘ g2h3↓ g2h3↙ g2h3← g2h3↖ g2f2↑ g2f2↗ g2f2→ g2f2↘ g2f2↓ g2f2↙ g2f2← g2f2↖ g2h2↑ g2h2↗ g2h2→ g2h2↘ g2h2↓ g2h2↙ g2h2← g2h2↖ g2f1↑ g2f1↗ g2f1→ g2f1↘ g2f1↓ g2f1↙ g2f1← g2f1↖ g2g1↑ g2g1↗ g2g1→ g2g1↘ g2g1↓ g2g1↙ g2g1← g2g1↖ g2g2↗ g2g2→ g2g2↘ g2g2↓ g2g2↙ g2g2← g2g2↖ h1h2 h1g1",
  },
  {
    boardFEN: "8/8/8/8/7i/6i1/7P/7q - - r",
    description: "capture scenario #17",
    expectedMovesUCI: "h2h3 h2g2 h2g1",
  },
  {
    boardFEN: "8/8/8/8/8/8/6iq/6I1 - - r",
    description: "capture scenario #18",
    expectedMovesUCI: "g1f1 g1h1",
  },
  {
    boardFEN: "8/8/8/8/8/8/7R↑/5I1q - - r",
    description: "capture scenario #19",
    expectedMovesUCI:
      "h2g3↑ h2g3↗ h2g3→ h2g3↘ h2g3↓ h2g3↙ h2g3← h2g3↖ h2h3↑ h2h3↗ h2h3→ h2h3↘ h2h3↓ h2h3↙ h2h3← h2h3↖ h2g2↑ h2g2↗ h2g2→ h2g2↘ h2g2↓ h2g2↙ h2g2← h2g2↖ h2g1↑ h2g1↗ h2g1→ h2g1↘ h2g1↓ h2g1↙ h2g1← h2g1↖ h2h2↗ h2h2→ h2h2↘ h2h2↓ h2h2↙ h2h2← h2h2↖ f1e2 f1f2 f1g2 f1e1 f1g1",
  },
  {
    boardFEN: "I7/1p6/1If5/8/8/8/8/8 - - r",
    description: "capture scenario #20",
    expectedMovesUCI: "a8b8 a8a7 b6a6 b6a5 b6b5",
  },
  {
    boardFEN: "8/8/8/8/4r←3/4I3/8/8 - - r",
    description: "capture scenario #21",
    expectedMovesUCI: "e3f4 e3f4xe4 e3d3 e3f3 e3d2 e3e2 e3f2",
  },
  {
    boardFEN: "8/8/8/8/4r←3/4I3/8/8 - - r",
    description: "capture scenario #22",
    expectedMovesUCI: "e3f4 e3f4xe4 e3d3 e3f3 e3d2 e3e2 e3f2",
  },
  {
    boardFEN: "8/8/8/8/4r→3/4I3/8/8 - - r",
    description: "capture scenario #23",
    expectedMovesUCI: "e3d4 e3d4xe4 e3d3 e3f3 e3d2 e3e2 e3f2",
  },
  {
    boardFEN: "8/8/8/8/4r→3/4I3/8/8 - - r",
    description: "capture scenario #24",
    expectedMovesUCI: "e3d4 e3d4xe4 e3d3 e3f3 e3d2 e3e2 e3f2",
  },
  {
    boardFEN: "8/8/8/8/3Ir↑3/8/8/8 - - r",
    description: "capture scenario #25",
    expectedMovesUCI: "d4c5 d4d5 d4c4 d4c3 d4d3 d4e3 d4e3xe4",
  },
  {
    boardFEN: "8/8/8/8/3Ir↑3/8/8/8 - - r",
    description: "capture scenario #26",
    expectedMovesUCI: "d4c5 d4d5 d4c4 d4c3 d4d3 d4e3 d4e3xe4",
  },
  {
    boardFEN: "8/8/8/8/3Ir↓3/8/8/8 - - r",
    description: "capture scenario #27",
    expectedMovesUCI: "d4c5 d4d5 d4e5 d4e5xe4 d4c4 d4c3 d4d3",
  },
  {
    boardFEN: "8/8/8/8/3Ir↓3/8/8/8 - - r",
    description: "capture scenario #28",
    expectedMovesUCI: "d4c5 d4d5 d4e5 d4e5xe4 d4c4 d4c3 d4d3",
  },
  {
    boardFEN: "8/8/8/8/3Iq3/8/8/8 - - r",
    description: "capture scenario #29",
    expectedMovesUCI: "d4c5 d4d5 d4e5 d4c4 d4c3 d4d3 d4e3",
  },
  {
    boardFEN: "8/8/5i2/6R↑i/5IiI/8/8/8 - - r",
    description: "capture scenario #30",
    expectedMovesUCI:
      "g5g6↑ g5g6↗ g5g6→ g5g6↘ g5g6↓ g5g6↙ g5g6← g5g6↖ g5h6↑ g5h6↗ g5h6→ g5h6↘ g5h6↓ g5h6↙ g5h6← g5h6↖ g5f5↑ g5f5↗ g5f5→ g5f5↘ g5f5↓ g5f5↙ g5f5← g5f5↖ g5g5↗ g5g5→ g5g5↘ g5g5↓ g5g5↙ g5g5← g5g5↖ f4e5 f4e4 f4e3 f4f3 h4h3",
  },
  {
    boardFEN: "q↓7/8/8/8/8/8/8/1I5Q↑ - - r rib1",
    description: "can't move a piece that was just reinforced",
    expectedMovesUCI: "h1g2 h1h2 h1g1 skip",
  },
  {
    boardFEN: "q↓7/8/8/8/8/8/I7/7Q↑ - - r a1a2",
    description: "can't move a piece that's already been moved this turn",
    expectedMovesUCI: "h1g2 h1h2 h1g1 skip",
  },
  {
    description: "armored infantry can't move through your own pieces",
    boardFEN: "q7/8/8/8/8/8/I↑7/F6Q - - r -",
    expectedMovesUCI: "a2a3 a2b3 a2b2 a2b1 a1b2 a1c3 a1b1 a1c1 h1g2 h1h2 h1g1",
  },
  {
    description: "armored artillery can't move through your own pieces",
    boardFEN: "q7/8/8/8/8/8/I↑7/T↑6Q - - r -",
    expectedMovesUCI:
      "a2a3 a2b3 a2b2 a2b1 a1b2↑ a1b2↗ a1b2→ a1b2↘ a1b2↓ a1b2↙ a1b2← a1b2↖ a1c3↑ a1c3↗ a1c3→ a1c3↘ a1c3↓ a1c3↙ a1c3← a1c3↖ a1b1↑ a1b1↗ a1b1→ a1b1↘ a1b1↓ a1b1↙ a1b1← a1b1↖ a1c1↑ a1c1↗ a1c1→ a1c1↘ a1c1↓ a1c1↙ a1c1← a1c1↖ a1a1↗ a1a1→ a1a1↘ a1a1↓ a1a1↙ a1a1← a1a1↖ h1g2 h1h2 h1g1",
  },
  {
    description: "armored infantry can't move through bombardment 1",
    boardFEN: "qr↓6/F↑7/8/8/8/8/8/7Q↑ - - r -",
    expectedMovesUCI: "a7a6 a7a5 h1g2 h1h2 h1g1",
  },
  {
    description: "armored infantry can't move through bombardment 1",
    boardFEN: "1r↘6/q7/1F↑6/8/8/8/8/7Q↑ - - r -",
    expectedMovesUCI:
      "b6b7 b6b7xb8 b6a6 b6c6 b6a5 b6b5 b6b4 b6c5 b6d4 h1g2 h1h2 h1g1",
  },
  {
    description: "can't deploy reserves onto bombarded squares",
    boardFEN: "q7/8/8/8/8/r↓7/8/7Q I - r -",
    expectedMovesUCI: "rib1 ric1 rid1 rie1 rif1 rig1 h1g2 h1h2 h1g1",
  },
  {
    description: "puzzle: collapse the center line",
    boardFEN: "q7/8/1i6/2fff3/2III3/5F2/8/7Q - - r -",
    expectedMovesUCI:
      "c4b4 c4b3 c4c3 c4d3 d4c3 d4d3 d4e3 e4f4 e4d3 e4e3 f3f4 f3f5 f3f5xe5 f3g4 f3h5 f3e3 f3d3 f3g3 f3h3 f3e2 f3d1 f3f2 f3f1 f3g2 h1g2 h1h2 h1g1",
  },
  {
    description: "armored infantry blocked by infantry",
    boardFEN: "q7/8/8/8/8/3f↓4/3F↑4/7Q - - r -",
    expectedMovesUCI: "d2c2 d2b2 d2e2 d2f2 d2c1 d2d1 d2e1 h1g2 h1h2 h1g1",
  },
  {
    description: "capture scenario #31",
    boardFEN: "q7/8/3i↓4/8/2I↑r↓f↓3/3I↑4/8/7Q - - r -",
    expectedMovesUCI:
      "c4b5 c4c5 c4d5 c4b4 c4b3 c4c3 d3c3 d3e3 d3c2 d3e2 h1g2 h1h2 h1g1",
  },
  {
    description: "capture scenario #32",
    boardFEN: "q7/8/8/2i↓5/3r↓I↑3/1I↑6/8/7Q - - r -",
    expectedMovesUCI:
      "e4d5 e4e5 e4f5 e4f4 e4e3 e4f3 b3a4 b3b4 b3c4 b3a3 b3c3 b3a2 b3b2 b3c2 h1g2 h1h2 h1g1",
  },
];

const MAKE_MOVE_TESTS: MakeMoveTest[] = [
  {
    description: "infantry capture engaged infantry",
    boardFEN: "q7/8/8/3i4/3II3/8/8/7Q - - r",
    moveUCI: "e4e5xd5",
    expectedBoardFEN: "q7/8/8/4I3/3I4/8/8/7Q - - r",
  },
];

describe("legal moves", () => {
  for (const test of LEGAL_MOVES_TESTS) {
    it(test.description, () => {
      const board = FENtoBoardState(test.boardFEN);
      const moves = getAllowedMoves({
        board: board.board,
        redReserve: board.redReserve,
        blueReserve: board.blueReserve,
        currentPlayerTurn: board.currentPlayerTurn ?? "RED", // TODO(tyler): this should come from the FEN
        thisTurnMoves: board.thisTurnMoves ?? [],
      });

      const expectedMoves = test.expectedMovesUCI.split(" ");
      const actualMoves = moves.map(allowedMoveToUci);

      console.log(actualMoves.join(" "));

      expect(actualMoves.length).toEqual(expectedMoves.length);
      expect(actualMoves).toEqual(expect.arrayContaining(expectedMoves));
    });
  }
});

describe("making moves", () => {
  for (const test of MAKE_MOVE_TESTS) {
    it(test.description, () => {
      const board = FENtoBoardState(test.boardFEN);
      const moves = getAllowedMoves({
        board: board.board,
        redReserve: board.redReserve,
        blueReserve: board.blueReserve,
        currentPlayerTurn: board.currentPlayerTurn ?? "RED", // TODO(tyler): this should come from the FEN
        thisTurnMoves: [],
      });

      const actualMoves = moves.map(allowedMoveToUci);
      expect(actualMoves).toContain(test.moveUCI);

      // TODO(tyler): add ability to test our boardgame.io game state
    });
  }
});

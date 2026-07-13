import { describe, expect, it } from "@jest/globals";
import { Board } from "./engine";
import {
  airborneDeterrenceFeatures,
  artilleryFormationFeatures,
  calculateEval,
  hangingPieceFeatures,
  openingDeploymentFeatures,
} from "./eval";
import { Blue, Red } from "./tests/test-boards";

const emptyBoard = (): Board =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)) as Board;

describe("hanging-piece evaluation", () => {
  it("penalizes a lone advanced piece relative to an equally-valued supported one", () => {
    const hanging = emptyBoard();
    hanging[7][7] = Red.HQ;
    hanging[6][0] = Red.INFANTRY;
    hanging[6][1] = Red.INFANTRY;
    hanging[6][2] = Red.INFANTRY;
    hanging[3][3] = Red.ARTILLERY(0);
    hanging[0][0] = Blue.HQ;

    const supported = emptyBoard();
    supported[7][7] = Red.HQ;
    supported[6][0] = Red.INFANTRY;
    supported[6][1] = Red.INFANTRY;
    supported[6][2] = Red.INFANTRY;
    supported[3][3] = Red.ARTILLERY(0);
    supported[3][4] = Red.INFANTRY;
    supported[0][0] = Blue.HQ;

    expect(calculateEval({ board: hanging })).toBeLessThan(
      calculateEval({ board: supported })
    );
  });

  it("reports distance and rank-extension evidence for a hanging piece", () => {
    const board = emptyBoard();
    board[7][7] = Red.HQ;
    board[6][0] = Red.INFANTRY;
    board[6][1] = Red.INFANTRY;
    board[6][2] = Red.INFANTRY;
    board[3][3] = Red.ARTILLERY(0);
    board[0][0] = Blue.HQ;

    expect(hangingPieceFeatures(board)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player: "RED",
          at: [3, 3],
          nearestSupportDistance: 3,
          ranksPastAnchor: 3,
        }),
      ])
    );
  });
});

describe("artillery formation", () => {
  it("rewards adjacent artillery with heavy artillery in the middle", () => {
    const board = emptyBoard();
    board[4][2] = Red.ARTILLERY(0);
    board[4][3] = { type: "HEAVY_ARTILLERY", player: "RED", orientation: 0 };
    board[4][4] = Red.ARTILLERY(0);

    expect(artilleryFormationFeatures(board)).toEqual([
      expect.objectContaining({
        player: "RED",
        adjacentPairs: 2,
        heavyArtilleryCentered: true,
      }),
    ]);
  });
});

describe("opening deployment", () => {
  it("rewards filling the home rank during the development phase", () => {
    const board = emptyBoard();
    board[7][5] = Red.INFANTRY;
    board[7][6] = Red.ARTILLERY(0);
    board[7][7] = Red.HQ;

    expect(openingDeploymentFeatures(board)).toEqual([
      expect.objectContaining({ player: "RED", homeRankOccupancy: 3 }),
    ]);
  });
});

describe("airborne deterrence", () => {
  it("values an airborne unit held ready against an exposed artillery", () => {
    const board = emptyBoard();
    board[7][0] = Red.AIRBORNE;
    board[7][7] = Red.HQ;
    board[3][3] = Blue.ARTILLERY(0);
    board[0][0] = Blue.HQ;

    expect(airborneDeterrenceFeatures(board)).toEqual([
      expect.objectContaining({
        player: "RED",
        readiness: "ready",
        exposedArtillery: [[3, 3]],
      }),
    ]);
  });

  it("does not value an artillery whose adjacent squares are all protected", () => {
    const board = emptyBoard();
    board[7][0] = Red.AIRBORNE;
    board[7][7] = Red.HQ;
    board[3][3] = Blue.ARTILLERY(0);
    board[3][2] = Blue.INFANTRY;
    board[3][4] = Blue.INFANTRY;
    board[4][3] = Blue.INFANTRY;
    board[0][0] = Blue.HQ;

    expect(airborneDeterrenceFeatures(board)).toEqual([]);
  });

  it("rewards simultaneous threats more than an isolated target", () => {
    const singleTarget = emptyBoard();
    singleTarget[7][0] = Red.AIRBORNE;
    singleTarget[7][7] = Red.HQ;
    singleTarget[3][3] = Blue.ARTILLERY(0);
    singleTarget[0][0] = Blue.HQ;

    const doubleTarget = emptyBoard();
    doubleTarget[7][0] = Red.AIRBORNE;
    doubleTarget[7][7] = Red.HQ;
    doubleTarget[3][3] = Blue.ARTILLERY(0);
    doubleTarget[5][5] = {
      type: "HEAVY_ARTILLERY",
      player: "BLUE",
      orientation: 0,
    };
    doubleTarget[0][0] = Blue.HQ;

    expect(airborneDeterrenceFeatures(doubleTarget)[0].bonus).toBeGreaterThan(
      airborneDeterrenceFeatures(singleTarget)[0].bonus
    );
  });
});

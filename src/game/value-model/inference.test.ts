import { endgame } from "@/game/variants";
import { extractValueFeatures, VALUE_FEATURE_NAMES } from "./features";
import {
  assertValueModelCompatible,
  predictFromFeatures,
  predictWinProbability,
} from "./inference";

const position = {
  board: endgame.board,
  redReserve: endgame.redReserve,
  blueReserve: endgame.blueReserve,
  currentPlayer: "RED" as const,
  turnNumber: 40,
};

describe("gradient-boosted value model", () => {
  it("uses the same feature schema as the generated artifact", () => {
    expect(() => assertValueModelCompatible()).not.toThrow();
    expect(extractValueFeatures(position, "RED")).toHaveLength(
      VALUE_FEATURE_NAMES.length
    );
  });

  it("returns finite calibrated probabilities for either perspective", () => {
    const red = predictWinProbability(position, "RED");
    const blue = predictWinProbability(position, "BLUE");
    expect(red).toBeGreaterThan(0);
    expect(red).toBeLessThan(1);
    expect(blue).toBeGreaterThan(0);
    expect(blue).toBeLessThan(1);
  });

  it("evaluates an exported tree vector directly", () => {
    const probability = predictFromFeatures(
      extractValueFeatures(position, "RED")
    );
    expect(Number.isFinite(probability)).toBe(true);
  });

  it("overrides the model for a captured HQ", () => {
    const terminal = JSON.parse(JSON.stringify(position)) as typeof position;
    terminal.board[0][0] = null;
    expect(predictWinProbability(terminal, "RED")).toBe(1);
    expect(predictWinProbability(terminal, "BLUE")).toBe(0);
  });
});

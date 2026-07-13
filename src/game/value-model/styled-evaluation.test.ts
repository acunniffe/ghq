import { endgame } from "@/game/variants";
import { PERSONALITIES, PersonalityId } from "./personalities";
import {
  evaluatePersonalityPosition,
  rankPersonalityCandidates,
  selectPersonalityCandidate,
} from "./styled-evaluation";

function clonePosition() {
  return {
    board: JSON.parse(JSON.stringify(endgame.board)) as typeof endgame.board,
    redReserve: { ...endgame.redReserve },
    blueReserve: { ...endgame.blueReserve },
    currentPlayer: "RED" as const,
    turnNumber: 40,
  };
}

describe("personality evaluation", () => {
  it("keeps objective value independent from personality", () => {
    const position = clonePosition();
    const fortress = evaluatePersonalityPosition(
      position,
      "RED",
      "fortress"
    );
    const gambler = evaluatePersonalityPosition(
      position,
      "RED",
      "tactical_gambler"
    );
    expect(fortress.objectiveWinProbability).toBe(
      gambler.objectiveWinProbability
    );
  });

  it("bounds every character's stylistic adjustment", () => {
    const position = clonePosition();
    for (const id of Object.keys(PERSONALITIES) as PersonalityId[]) {
      const evaluation = evaluatePersonalityPosition(position, "RED", id);
      expect(Math.abs(evaluation.styleBonus)).toBeLessThanOrEqual(
        PERSONALITIES[id].styleBonusCap
      );
    }
  });

  it("suppresses personality bonuses in fully forcing positions", () => {
    const evaluation = evaluatePersonalityPosition(
      clonePosition(),
      "RED",
      "battery_commander",
      { tacticality: 1 }
    );
    expect(evaluation.styleBonus).toBe(0);
  });

  it("does not allow theme to cross the objective-value gate", () => {
    const position = clonePosition();
    const ranked = rankPersonalityCandidates(
      [
        { id: "sound", position, objectiveWinProbability: 0.7 },
        { id: "thematic-blunder", position, objectiveWinProbability: 0.5 },
      ],
      "RED",
      "tactical_gambler"
    );
    expect(ranked.map(({ id }) => id)).toEqual(["sound"]);
  });

  it("lets a character choose its style among objectively close turns", () => {
    const grouped = clonePosition();
    const scattered = clonePosition();
    scattered.board[3][7] = scattered.board[5][5];
    scattered.board[5][5] = null;

    const selected = selectPersonalityCandidate(
      [
        { id: "grouped-battery", position: grouped, objectiveWinProbability: 0.6 },
        { id: "scattered-guns", position: scattered, objectiveWinProbability: 0.61 },
      ],
      "RED",
      "battery_commander"
    );
    expect(selected?.id).toBe("grouped-battery");
  });

  it("always selects a proven win regardless of style", () => {
    const position = clonePosition();
    const selected = selectPersonalityCandidate(
      [
        { id: "pretty", position, objectiveWinProbability: 0.95 },
        {
          id: "forced-win",
          position,
          objectiveWinProbability: 0.1,
          forcedOutcome: "win",
        },
      ],
      "RED",
      "fortress"
    );
    expect(selected?.id).toBe("forced-win");
    expect(selected?.evaluation.styleBonus).toBe(0);
  });
});

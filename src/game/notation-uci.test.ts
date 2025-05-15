import { describe, expect, it } from "@jest/globals";
import { allowedMoveToUci, allowedMoveFromUci } from "./notation-uci";
import { AllowedMove } from "./engine";

describe("UCI notation", () => {
  it("can serialize and deserialize a reinforcement move", () => {
    const move: AllowedMove = {
      name: "Reinforce",
      args: ["INFANTRY", [7, 0], [6, 0]],
    };

    const uci = allowedMoveToUci(move);
    expect(uci).toBe("ria1xa2");

    const deserialized = allowedMoveFromUci(uci);
    expect(deserialized).toEqual(move);
  });

  it("can serialize and deserialize a move", () => {
    const move: AllowedMove = {
      name: "Move",
      args: [
        [0, 0],
        [1, 0],
      ],
    };

    const uci = allowedMoveToUci(move);
    expect(uci).toBe("a8a7");

    const deserialized = allowedMoveFromUci(uci);
    expect(deserialized).toEqual(move);
  });

  it("can serialize and deserialize a move with a capture preference", () => {
    const move: AllowedMove = {
      name: "Move",
      args: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    };

    const uci = allowedMoveToUci(move);
    expect(uci).toBe("a8a7xa6");

    const deserialized = allowedMoveFromUci(uci);
    expect(deserialized).toEqual(move);
  });

  it("can serialize and deserialize a move with an orientation", () => {
    const move: AllowedMove = {
      name: "MoveAndOrient",
      args: [[0, 0], [1, 0], 90],
    };

    const uci = allowedMoveToUci(move);
    expect(uci).toBe("a8a7→");

    const deserialized = allowedMoveFromUci(uci);
    expect(deserialized).toEqual(move);
  });

  it("can serialize and deserialize a skip move", () => {
    const move: AllowedMove = {
      name: "Skip",
      args: [],
    };

    const uci = allowedMoveToUci(move);
    expect(uci).toBe("skip");

    const deserialized = allowedMoveFromUci(uci);
    expect(deserialized).toEqual(move);
  });

  it("can serialize and deserialize a move in place with rotation", () => {
    const move: AllowedMove = {
      name: "MoveAndOrient",
      args: [[0, 0], [0, 0], 180],
    };

    const uci = allowedMoveToUci(move);
    expect(uci).toBe("a8a8↓");

    const deserialized = allowedMoveFromUci(uci);
    expect(deserialized).toEqual(move);
  });

  it("can deserialize and serialize moves from a sample game", () => {
    const gameMoves = require("../game/tests/testdata/game1.json");
    for (const moveUCI of gameMoves) {
      const move = allowedMoveFromUci(moveUCI);
      const moveUCI2 = allowedMoveToUci(move);
      console.log(moveUCI, moveUCI2);
      expect(moveUCI2).toEqual(moveUCI);
    }
  });
});

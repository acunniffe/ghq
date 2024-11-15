import { describe, expect, it } from "@jest/globals";
import { GHQState } from "@/game/engine";
import { Red, Blue } from "@/game/tests/test-boards";
import { getGameoverState } from "./gameover-logic";

const R_HQ = Red.HQ;
const B_HQ = Blue.HQ;

describe("gameover", () => {
  it("not gameover when hq is on board", () => {
    const board: GHQState["board"] = [
      [R_HQ, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, B_HQ],
    ];
    expect(getGameoverState({ board } as GHQState)).toBeUndefined();
  });

  it("is gameover when an hq is missing", () => {
    const board: GHQState["board"] = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, B_HQ],
    ];
    expect(getGameoverState({ board } as GHQState)).toEqual({
      status: "WIN",
      winner: "BLUE",
      reason: "by HQ capture",
    });
  });

  it("red wins when blue runs out of time", () => {
    const G: GHQState = {
      redElapsed: 0,
      blueElapsed: 101,
      timeControl: 100,
    } as GHQState;
    expect(getGameoverState(G)).toEqual({
      status: "WIN",
      winner: "RED",
      reason: "on time",
    });
  });

  it("blue wins when red runs out of time", () => {
    const G: GHQState = {
      redElapsed: 101,
      blueElapsed: 0,
      timeControl: 100,
    } as GHQState;
    expect(getGameoverState(G)).toEqual({
      status: "WIN",
      winner: "BLUE",
      reason: "on time",
    });
  });
});

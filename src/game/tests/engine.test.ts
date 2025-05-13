import { describe, it } from "@jest/globals";
import { newLocalGHQGame } from "../engine";
import { Client } from "boardgame.io/client";
import { allowedMoveFromUci } from "../notation-uci";

describe("engine", () => {
  it("should be able to make a move", async () => {
    const gameMoves = require("./testdata/game1.json");
    const client = Client({
      game: newLocalGHQGame(),
    });

    if (!client.game.moves) {
      throw new Error("No moves found");
    }

    for (const [i, m] of Object.entries(gameMoves)) {
      const move = allowedMoveFromUci(m as string);
      console.log(i, m);

      if (move.name === "Move") {
        // @ts-ignore
        client.moves.Move(...move.args);
      } else if (move.name === "MoveAndOrient") {
        // @ts-ignore
        client.moves.MoveAndOrient(...move.args);
      } else if (move.name === "Reinforce") {
        // @ts-ignore
        client.moves.Reinforce(...move.args);
      } else if (move.name === "Skip") {
        // @ts-ignore
        client.moves.Skip();
      } else if (move.name === "AutoCapture") {
        // pass
        // TODO(tyler): we should keep bombard in the onBegin phase (or add it immediately after the third move)
        // TODO(tyler): then we should have a client.moves.AutoCapture() to process auto captures
        // TODO(tyler): and the UI should automatically call client.moves.AutoCapture() at the start of a turn, if the situation is unambiguous
      } else {
        throw new Error(`Unknown move: ${m}`);
      }

      // free auto captures are going to be a huge problem cross-engine

      const state = client.getState();
      if (state?.G.thisTurnMoves.length === 3) {
        client.moves.Skip();
      }
    }
  });
});

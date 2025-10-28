/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

import { RandomBot } from "boardgame.io/ai";
import type { Game, State } from "boardgame.io";
import { loadEngine, newGHQGameV2, GameEngine } from "@/game/engine-v2";
import { GHQState } from "@/game/engine";

const isWorker =
  typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let pyodideModule: any;
if (isWorker) {
  self.importScripts(
    "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js"
  );
  // @ts-ignore
  pyodideModule = { loadPyodide: self.loadPyodide };
}

class CustomRandomBot extends RandomBot {
  constructor(opts: any) {
    super({
      ...opts,
      enumerate: opts.game.ai!.enumerate.bind(opts.game),
    });
  }
}

let engine: GameEngine | null = null;

self.onmessage = async (e) => {
  const { state, playerID } = e.data;

  if (!engine) {
    engine = await loadEngine(() => pyodideModule.loadPyodide());
  }

  if (!engine) {
    throw new Error("Engine not loaded");
  }

  try {
    const game = newGHQGameV2({ engine, type: "bot" });
    const bot = new CustomRandomBot({ game, playerID });

    const result = await bot.play(state, playerID);
    self.postMessage({ move: result });
  } catch (error: any) {
    console.error("Error in bot calculation:", error);
    console.error("Error stack:", error?.stack);
    self.postMessage({
      error: error?.message || "Unknown error in bot calculation",
    });
  }
};

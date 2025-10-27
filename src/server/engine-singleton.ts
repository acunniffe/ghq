import { GameEngine } from "@/game/engine-v2";
import { loadV2Engine } from "./engine";

let engineInstance: GameEngine | null = null;
let enginePromise: Promise<GameEngine> | null = null;

export async function getEngine(): Promise<GameEngine> {
  if (engineInstance) {
    return engineInstance;
  }

  if (enginePromise) {
    return enginePromise;
  }

  enginePromise = loadV2Engine();
  engineInstance = await enginePromise;
  enginePromise = null;

  return engineInstance;
}

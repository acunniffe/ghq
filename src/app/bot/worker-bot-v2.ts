import type { State } from "boardgame.io";
import type { BotAction } from "boardgame.io/dist/types/src/ai/bot";
import type { Node } from "boardgame.io/dist/types/src/ai/mcts-bot";

export class WorkerBot {
  private worker: Worker | null = null;
  private iterations: number;
  private playoutDepth: number;

  constructor(opts: {
    game: any;
    playerID: string;
    iterations?: number;
    playoutDepth?: number;
  }) {
    this.iterations = opts.iterations || 1000;
    this.playoutDepth = opts.playoutDepth || 20;

    if (typeof window !== "undefined") {
      this.worker = new Worker(new URL("./random-worker.ts", import.meta.url), {
        type: "module",
      });
    }
  }

  async play(
    state: State<any>,
    playerID: string
  ): Promise<{ action: BotAction; metadata: Node }> {
    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e) => {
        if (e.data.error) {
          reject(new Error(e.data.error));
          return;
        }
        resolve(e.data.move);
      };

      this.worker!.onerror = (error) => {
        reject(error);
      };

      this.worker!.postMessage({
        state: {
          G: state.G,
          ctx: state.ctx,
        },
        playerID,
        iterations: this.iterations,
        playoutDepth: this.playoutDepth,
        seed: Math.random(),
      });
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

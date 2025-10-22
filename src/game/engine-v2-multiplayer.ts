import { GameEngine, PythonBoard, Turn } from "./engine-v2";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";

export type OnTurnPlayedCallback = (turn: Turn) => void;

export interface Multiplayer {
  initGame(): Promise<void>;
  sendTurn(turn: Turn): Promise<void>;
  onTurnPlayed(callback: OnTurnPlayedCallback): void;
}

export class BotMultiplayer implements Multiplayer {
  private board: PythonBoard;
  private _callbacks: OnTurnPlayedCallback[];

  constructor(private engine: GameEngine, private fen?: string) {
    this.board = this.engine.BaseBoard(fen);
    this._callbacks = [];
  }

  async initGame(): Promise<void> {
    this.board = this.engine.BaseBoard(this.fen);
  }

  async sendTurn(turn: Turn): Promise<void> {
    for (const move of turn.moves) {
      const allowedMove = this.engine.Move.from_uci(allowedMoveToUci(move));
      this.board.push(allowedMove);
    }

    if (this._callbacks.length === 0) {
      throw new Error("onTurnPlayed callback not set");
    }

    if (this.board.is_red_turn()) {
      return;
      // return [
      //   {
      //     move: "Skip",
      //     args: [],
      //   },
      // ];
    }

    const replyTurn: Turn = {
      turn: turn.turn + 1,
      moves: [],
      elapsedSecs: 0.1,
    };
    const player = this.engine.ValuePlayer(this.board);
    for (let i = 0; i < 3; i++) {
      // const start = Date.now();
      const move = player.get_next_move();

      // Apply to the board
      this.board.push(move);

      // Add to the reply turn
      replyTurn.moves.push(allowedMoveFromUci(move.uci()));

      // console.log(`Took ${Date.now() - start}ms`);
      if (move.name === "Skip") {
        break;
      }
    }

    this._callbacks.forEach((callback) => callback(replyTurn));
  }

  onTurnPlayed(callback: OnTurnPlayedCallback): void {
    this._callbacks.push(callback);
  }
}

import { API_URL } from "@/app/live/config";
import { GameEngine, PythonBoard, Turn } from "./engine-v2";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";
import { ghqFetch, SendTurnRequest } from "@/lib/api";

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

export class OnlineMultiplayer implements Multiplayer {
  private apiUrl = API_URL;
  private _callbacks: OnTurnPlayedCallback[];
  private abortController?: AbortController;
  private isConnected = false;
  private retryCount = 0;
  private maxRetries = 5;
  private baseRetryDelay = 1000;
  private processedTurnIndices = new Set<number>();

  constructor(
    private id: string,
    private credentials: string,
    private playerId: string,
    private getToken: () => Promise<string | null>
  ) {
    this._callbacks = [];
  }

  async initGame(): Promise<void> {
    await this.streamTurns();
  }

  private async streamTurns(): Promise<void> {
    // NB(tyler): This streaming code is mostly Cursor and I apologize for it.
    if (this.abortController?.signal.aborted) {
      return;
    }

    try {
      const token = await this.getToken();
      this.abortController = new AbortController();

      const response = await fetch(`${this.apiUrl}/v3/match/${this.id}/turns`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      this.isConnected = true;
      this.retryCount = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("Stream complete");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              // console.log("Received turns:", parsed);

              if (parsed.turns && Array.isArray(parsed.turns)) {
                const startIndex = parsed.startIndex ?? 0;
                for (let i = 0; i < parsed.turns.length; i++) {
                  const turnIndex = startIndex + i;
                  if (!this.processedTurnIndices.has(turnIndex)) {
                    this.processedTurnIndices.add(turnIndex);
                    const turn = parsed.turns[i];
                    this._callbacks.forEach((callback) => callback(turn));
                  }
                }
              }
            } catch (error) {
              console.error("Error parsing SSE data:", error);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Stream aborted");
        return;
      }

      console.error("Stream error:", error);
      this.isConnected = false;

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.baseRetryDelay * Math.pow(2, this.retryCount - 1);
        console.log(
          `Reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.streamTurns();
      } else {
        console.error(
          `Failed to connect after ${this.maxRetries} attempts. Giving up.`
        );
        throw error;
      }
    }
  }

  async sendTurn(turn: Turn): Promise<void> {
    const request: SendTurnRequest = {
      turn,
      playerId: this.playerId,
      credentials: this.credentials,
    };
    const data = await ghqFetch<any>({
      url: `${this.apiUrl}/v3/match/${this.id}/turns`,
      method: "POST",
      body: JSON.stringify(request),
      getToken: this.getToken,
    });

    if (data.error) {
      throw new Error(data.error);
    }
  }

  onTurnPlayed(callback: OnTurnPlayedCallback): void {
    this._callbacks.push(callback);
  }

  disconnect(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }
}

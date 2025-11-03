import { GameEngine, PythonBoard, Turn } from "./engine-v2";
import { allowedMoveFromUci, allowedMoveToUci } from "./notation-uci";
import { ghqFetch, SendTurnRequest } from "@/lib/api";
import { createPGN, pgnToTurns } from "./pgn";
import { API_URL } from "@/app/live/config";

export type OnTurnPlayedCallback = (turn: Turn) => void;

class TurnReplicator {
  private turns: Map<number, Turn> = new Map();
  private nextExpectedTurn = 1;
  private callbacks: OnTurnPlayedCallback[] = [];

  addCallback(callback: OnTurnPlayedCallback): void {
    this.callbacks.push(callback);
  }

  receiveTurns(incomingTurns: Turn[], skipDelivery = false): void {
    if (skipDelivery) {
      for (const turn of incomingTurns) {
        if (turn.turn === this.nextExpectedTurn) {
          this.nextExpectedTurn++;
        }
      }
      this.deliverOrderedTurns();
      return;
    }

    for (const turn of incomingTurns) {
      if (!this.turns.has(turn.turn)) {
        this.turns.set(turn.turn, turn);
      }
    }

    this.deliverOrderedTurns();
  }

  private deliverOrderedTurns(): void {
    while (this.turns.has(this.nextExpectedTurn)) {
      const turn = this.turns.get(this.nextExpectedTurn)!;
      this.callbacks.forEach((callback) => callback(turn));
      this.turns.delete(this.nextExpectedTurn);
      this.nextExpectedTurn++;
    }
  }
}

export interface Multiplayer {
  initGame(): Promise<void>;
  sendTurn(turn: Turn): Promise<void>;
  onTurnPlayed(callback: OnTurnPlayedCallback): void;
}

interface BotGameHistory {
  games: { id: string; pgn: string }[];
}

export class BotMultiplayer implements Multiplayer {
  private board: PythonBoard;
  private _callbacks: OnTurnPlayedCallback[];
  private _id: string;

  constructor(private engine: GameEngine, id: string, private fen?: string) {
    this.board = this.engine.BaseBoard(fen);
    this._id = id;
    this._callbacks = [];
  }

  loadGameTurns(id: string): Turn[] {
    const d = localStorage.getItem("bot_game_history");
    if (!d) {
      return [];
    }
    const games = JSON.parse(d) as BotGameHistory;
    const pgn = games.games?.find((game) => game.id === id)?.pgn ?? "";
    return pgnToTurns(pgn);
  }

  appendGameTurn(id: string, turn: Turn): void {
    const games = JSON.parse(
      localStorage.getItem("bot_game_history") || '{"games":[]}'
    ) as BotGameHistory;
    const currentGame = games.games.find((game) => game.id === id) || {
      id,
      pgn: "",
    };

    // Remove the current game from the list
    games.games = games.games.filter((game) => game.id !== id);

    // Append the turn to the current game
    const turns = this.loadGameTurns(id);
    turns.push(turn);
    currentGame.pgn = createPGN(turns);

    // Add the current game back to the list
    if (!games.games) {
      games.games = [];
    }
    games.games.push(currentGame);

    // Limit the number of games to 10
    if (games.games.length > 10) {
      games.games = games.games.slice(-10);
    }

    localStorage.setItem("bot_game_history", JSON.stringify(games));
  }

  async initGame(): Promise<void> {
    this.board = this.engine.BaseBoard(this.fen);
    const turns = this.loadGameTurns(this._id);
    if (this._callbacks.length === 0) {
      throw new Error("onTurnPlayed callback not set");
    }
    for (const turn of turns) {
      for (const move of turn.moves) {
        const allowedMove = this.engine.Move.from_uci(allowedMoveToUci(move));
        this.board.push(allowedMove);
      }
      this._callbacks.forEach((callback) => callback(turn));
    }
  }

  async sendTurn(turn: Turn): Promise<void> {
    for (const move of turn.moves) {
      const allowedMove = this.engine.Move.from_uci(allowedMoveToUci(move));
      this.board.push(allowedMove);
    }

    this.appendGameTurn(this._id, turn);

    if (this._callbacks.length === 0) {
      throw new Error("onTurnPlayed callback not set");
    }

    if (this.board.outcome() !== undefined) {
      return;
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

      if (move.auto_capture_type) {
        // If the move is an auto capture, we don't want to count it as a move,
        // so we decrement the index.
        i = i - 1;
      }

      // Apply to the board
      this.board.push(move);

      // Add to the reply turn
      replyTurn.moves.push(allowedMoveFromUci(move.uci()));

      // console.log(`Took ${Date.now() - start}ms`);
      if (move.name === "Skip") {
        break;
      }
    }

    this.appendGameTurn(this._id, replyTurn);

    // do this in the background
    setTimeout(() => {
      this._callbacks.forEach((callback) => callback(replyTurn));
    }, 1);
  }

  onTurnPlayed(callback: OnTurnPlayedCallback): void {
    this._callbacks.push(callback);
  }
}

export class OnlineMultiplayer implements Multiplayer {
  private abortController?: AbortController;
  private eventSource?: EventSource;
  private isConnected = false;
  private retryCount = 0;
  private maxRetries = 20;
  private baseRetryDelay = 1000;
  private replicator: TurnReplicator;

  constructor(
    private id: string,
    private credentials: string,
    private playerId: string,
    private getToken: () => Promise<string | null>
  ) {
    this.replicator = new TurnReplicator();
  }

  async initGame(): Promise<void> {
    this.streamTurnsSSE();
  }

  private async streamTurns(): Promise<void> {
    // NB(tyler): This streaming code is mostly Cursor and I apologize for it.
    if (this.abortController?.signal.aborted) {
      return;
    }

    // TODO(tyler): seems like tokens are expiring, we should figure out how to refresh the connection or do something else.

    try {
      const token = await this.getToken();
      this.abortController = new AbortController();

      // NB(tyler): for now, we still use the old API for sending turns
      const response = await fetch(`${API_URL}/v3/match/${this.id}/turns`, {
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
                this.replicator.receiveTurns(parsed.turns);
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
        const delay = Math.min(
          this.baseRetryDelay * Math.pow(2, this.retryCount - 1),
          30_000
        );
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

  private streamTurnsSSE(): void {
    const url = `${API_URL}/v3/match/${this.id}/turns`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.isConnected = true;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.turns && Array.isArray(parsed.turns)) {
          this.replicator.receiveTurns(parsed.turns);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    this.eventSource.onerror = () => {
      this.isConnected = false;
    };
  }

  async sendTurn(turn: Turn): Promise<void> {
    const request: SendTurnRequest = {
      turn,
      playerId: this.playerId,
      credentials: this.credentials,
    };

    const data = await ghqFetch<any>({
      url: `${API_URL}/v3/match/${this.id}/turns`,
      method: "POST",
      body: JSON.stringify(request),
      getToken: this.getToken,
    });

    if (data.error) {
      throw new Error(data.error);
    }

    this.replicator.receiveTurns([turn], true);
  }

  onTurnPlayed(callback: OnTurnPlayedCallback): void {
    this.replicator.addCallback(callback);
  }

  disconnect(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }
}

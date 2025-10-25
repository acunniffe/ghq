import { TimeControl } from "@/game/constants";
import { GameClient, GameEngine, Turn } from "@/game/engine-v2";
import { SendTurnRequest } from "@/lib/api";
import Router from "@koa/router";
import { Server } from "boardgame.io";
import { nanoid } from "nanoid";
import { PassThrough } from "stream";
import { MatchV3, MatchV3Info, User } from "@/lib/types";
import { createPGN, pgnToTurns } from "@/game/pgn";
import {
  createActiveMatches,
  createMatchV3,
  deleteActiveMatches,
  fetchMatchV3,
  getActiveMatch,
  listInProgressLiveMatches,
  onMatchChange,
  updateMatchPGN,
  updatePlayerElo,
} from "./matchv3-store";
import { createHash } from "node:crypto";
import { GameoverState } from "@/game/engine";
import { SupabaseMatch } from "./supabase";
import { updateUserStats } from "./user-stats";
import { getUser } from "@/lib/supabase";
import { calculateElo } from "@/game/elo";
import { allowedMoveToUci } from "@/game/notation-uci";

interface Listener {
  id: string;
  stream: PassThrough;
  gameId: string;
  lastTurnIndex: number;
}

const gameIdsToListenerIds: Record<string, Set<string>> = {};
const listeners: Record<string, Listener> = {};

export function sendTurnsToListeners(gameId: string, turns: Turn[]) {
  const listenerIds = gameIdsToListenerIds[gameId];
  if (!listenerIds) {
    console.error("no listeners found for game", gameId);
    return;
  }
  // console.log("sending turns to listeners", listenerIds);

  for (const listenerId of listenerIds) {
    sendGameTurns(listenerId, turns);
  }
}

export function sendGameTurns(listenerId: string, turns: Turn[]) {
  const listener = listeners[listenerId];

  if (!listener) {
    console.error("listener is not initialized for client:", listenerId);
    return;
  }

  const newTurns = turns.slice(listener.lastTurnIndex);

  if (newTurns.length === 0) {
    return;
  }

  const data = {
    turns: newTurns,
  };

  // console.log("sending turns to listener", listenerId, {
  //   turns: newTurns,
  // });

  const formattedData = `data: ${JSON.stringify(data)}\n\n`;
  listener.stream.write(formattedData);

  listener.lastTurnIndex = turns.length;
}

async function sendInitialTurns(listenerId: string, gameId: string) {
  const game = await fetchMatchV3(gameId);
  if (!game) {
    return;
  }

  const turns = pgnToTurns(game.pgn);
  sendGameTurns(listenerId, turns);
}

export function addGameServerRoutes(
  router: Router<any, Server.AppCtx>,
  engine: GameEngine
) {
  onMatchChange((match) => {
    const turns = pgnToTurns(match.pgn);
    sendTurnsToListeners(match.id, turns);
  });

  const runMatchLifecycle = () => {
    matchLifecycleV3(engine).finally(() => {
      setTimeout(runMatchLifecycle, 10_000);
    });
  };

  if (process.env.NODE_ENV !== "development") {
    runMatchLifecycle();
  }

  router.get("/v3/match/:id", async (ctx) => {
    const gameId = ctx.params.id as string;
    const game = await fetchMatchV3(gameId);
    if (!game) {
      ctx.throw(404, "Game not found");
      return;
    }
    const userId = ctx.state?.auth?.userId;
    const matchInfo = await getV3MatchInfo(gameId, userId);
    if (!matchInfo) {
      ctx.throw(404, "Game not found");
      return;
    }

    ctx.body = JSON.stringify(matchInfo);
  });

  router.get("/v3/match/:id/turns", async (ctx) => {
    const gameId = ctx.params.id as string;
    const game = await fetchMatchV3(gameId);
    if (!game) {
      ctx.throw(404, "Game not found");
      return;
    }

    const listenerId = nanoid();
    const stream = new PassThrough();

    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    ctx.body = stream;

    // console.log("adding listener", listenerId);
    listeners[listenerId] = {
      id: listenerId,
      stream,
      gameId,
      lastTurnIndex: 0,
    };

    if (!gameIdsToListenerIds[gameId]) {
      gameIdsToListenerIds[gameId] = new Set();
    }
    gameIdsToListenerIds[gameId].add(listenerId);

    ctx.req.on("close", () => {
      // console.log("removing listener", listenerId);
      stream.end();
      delete listeners[listenerId];
      gameIdsToListenerIds[gameId]?.delete(listenerId);
    });

    await sendInitialTurns(listenerId, gameId);
  });

  router.post("/v3/match/:id/turns", async (ctx) => {
    const userId = ctx.state.auth?.userId;
    if (!userId) {
      ctx.throw(401, "Unauthorized");
      return;
    }

    const id = ctx.params.id as string;
    const match = await fetchMatchV3(id);
    if (!match) {
      ctx.throw(404, "Game not found");
      return;
    }

    const turnReq = ctx.request.body as SendTurnRequest;

    if (!turnReq.credentials) {
      ctx.throw(400, "Credentials are required");
      return;
    }
    if (!turnReq.playerId) {
      ctx.throw(400, "Player ID is required");
      return;
    }
    if (!turnReq.turn) {
      ctx.throw(400, "Turn is required");
      return;
    }

    if (!isTurnAuthorized(userId, turnReq, match)) {
      ctx.throw(401, "Unauthorized");
      return;
    }

    const { turn } = turnReq;

    const updatedMatch = await updateMatchPGN(id, (match): SupabaseMatch => {
      const turns = pgnToTurns(match.pgn || "");

      const timeControl = getSupabaseMatchTimeControl(match);

      // TODO(tyler): can we cache this game client per match id?
      const game = new GameClient({
        engine,
        isPassAndPlayMode: true,
        timeControl,
        gameStartTimeMs: getGameStartTimeMs(match?.created_at?.toISOString()),
      });

      // Apply the historical moves to the game state
      try {
        for (const turn of turns) {
          game.pushTurn(turn);
        }
      } catch (error) {
        console.error("Error applying moves to game", error);
        ctx.throw(400, "Invalid move");
      }

      const getWinnerId = (gameover: GameoverState) => {
        return gameover.winner
          ? gameover.winner === "RED"
            ? match.player0_id
            : match.player1_id
          : null;
      };

      // Check for gameover due to timeout or something already on the board.
      const gameoverDueToTimeout = game.gameover();
      if (gameoverDueToTimeout) {
        return {
          ...match,
          status: gameoverDueToTimeout.status,
          winner_id: getWinnerId(gameoverDueToTimeout),
          gameover_reason: gameoverDueToTimeout.reason,
        };
      }

      // debugPrintGameState(game, turn);

      // Validate that the turn can be applied onto the game successfully
      game.pushTurn(turn);

      const updatedMatch = { ...match };

      // Then check gameover again because there could have been bombardment or something else that ended the game.
      const gameover = game.gameover();
      if (gameover) {
        updatedMatch.status = gameover.status;
        updatedMatch.winner_id = getWinnerId(gameover);
        updatedMatch.gameover_reason = gameover.reason;
      }

      // TODO(tyler): validate that time is accurate within 1 second of the actual time

      // TODO(tyler): set a time to check back for game end based on the upcoming player's time left

      turns.push(turn);
      updatedMatch.pgn = createPGN(turns);

      // Update the current player turn user id
      updatedMatch.current_turn_player_id =
        game.currentPlayerTurn() === "RED"
          ? match.player0_id
          : match.player1_id;

      return updatedMatch;
    });

    if (updatedMatch.status) {
      await deleteActiveMatches(updatedMatch.id);
      await updateUserElos(match);
    }

    ctx.body = JSON.stringify({ success: true });
  });
}

export interface CreateNewV3MatchOptions {
  user0: User;
  user1: User;
  timeControlName: string;
  timeControl: TimeControl;
  rated: boolean;
  isCorrespondence: boolean;
  startingFen?: string;
}

export async function createNewV3Match({
  user0,
  user1,
  timeControlName,
  timeControl,
  rated,
  startingFen,
  isCorrespondence,
}: CreateNewV3MatchOptions): Promise<void> {
  const matchId = nanoid();
  const player0Creds = nanoid();
  const player1Creds = nanoid();
  const match: MatchV3 = {
    id: matchId,
    createdAt: new Date().toISOString(),
    player0UserId: user0.id,
    player0CredentialsHash: hashCredentials(player0Creds),
    player0Elo: user0.elo,
    player1UserId: user1.id,
    player1CredentialsHash: hashCredentials(player1Creds),
    player1Elo: user1.elo,
    currentPlayerTurnUserId: user0.id,
    timeControlName,
    timeControlAllowedTime: timeControl.time,
    timeControlBonus: timeControl.bonus,
    timeControlVariant: timeControl.variant,
    rated,
    isCorrespondence,
    startingFen,
    pgn: "",
  };
  await createMatchV3(match);
  await createActiveMatches({
    matchId,
    player0UserId: user0.id,
    player1UserId: user1.id,
    player0Credentials: player0Creds,
    player1Credentials: player1Creds,
    isCorrespondence,
  });
}

function hashCredentials(credentials: string): string {
  return createHash("sha256").update(credentials).digest("hex");
}

export interface ActiveMatch {
  id: string;
  playerId: "0" | "1";
  credentials: string;
}

export async function getV3MatchInfo(
  id: string,
  userId?: string
): Promise<MatchV3Info | null> {
  const match = await fetchMatchV3(id);
  if (!match) {
    return null;
  }

  if (userId) {
    const activeMatch = await getActiveMatch(userId, match.id);
    if (activeMatch) {
      return {
        match,
        playerInfo: {
          playerId: activeMatch.playerId,
          credentials: activeMatch.credentials,
        },
      };
    }
  }
  return { match };
}

async function updateUserElos(match: MatchV3): Promise<void> {
  if (match.status === "ABORTED") {
    console.log("Match aborted, skipping elo update", match.id);
    return;
  } else if (!match.rated) {
    console.log("Unrated match, skipping elo update", match.id);
    return;
  }

  const [player0, player1] = await Promise.all([
    getUser(match.player0UserId),
    getUser(match.player1UserId),
  ]);

  updateUserStats(player0);
  const player0Elo = calculateElo(
    player0.elo,
    player1.elo,
    match.status === "DRAW"
      ? 0.5
      : match.winnerUserId === match.player0UserId
      ? 1
      : 0
  );

  updateUserStats(player1);
  const player1Elo = calculateElo(
    player1.elo,
    player0.elo,
    match.status === "DRAW"
      ? 0.5
      : match.winnerUserId === match.player1UserId
      ? 1
      : 0
  );

  await Promise.all([
    updatePlayerElo(player0, player0Elo),
    updatePlayerElo(player1, player1Elo),
  ]);
}

function debugPrintGameState(game: GameClient, turn: Turn) {
  console.log({
    message: "Allowed moves",
    allowedMoves: game
      .getAllowedMoves()
      .map((m) => allowedMoveToUci(m))
      .join(" "),
    currentPlayer: game.currentPlayer(),
    currentPlayerTurn: game.currentPlayerTurn(),
    isMyTurn: game.isMyTurn(),
    needsTurnConfirmation: game.needsTurnConfirmation,
  });
  console.log({
    message: "Pushing turn",
    board: game.fen(),
    turn: turn.moves.map((m) => allowedMoveToUci(m)),
  });
}

function isTurnAuthorized(
  authenticatedUserId: string,
  turnReq: SendTurnRequest,
  match: MatchV3
): boolean {
  const { turn, playerId, credentials } = turnReq;
  const requiredHashCredentials =
    playerId === "0"
      ? match.player0CredentialsHash
      : match.player1CredentialsHash;
  const requiredPlayerId =
    playerId === "0" ? match.player0UserId : match.player1UserId;

  const requiredTurnValidator = playerId === "0" ? isOdd : isEven; // 0 is red (odd numbered turns), 1 is blue (even numbered turns)

  const isAuthorized =
    authenticatedUserId === requiredPlayerId &&
    hashCredentials(credentials) === requiredHashCredentials &&
    // either they're playing the correct order turn or they've resigned
    (requiredTurnValidator(turn) || turn.playerResigned === playerId);

  if (!isAuthorized) {
    console.log("Unauthorized turn", {
      authenticatedUserId,
      requiredPlayerId,
      hashCredentials: hashCredentials(credentials),
      requiredHashCredentials,
      turn,
      isTurnValidated: requiredTurnValidator(turn),
    });
  }

  return isAuthorized;
}

function isEven(turn: Turn): boolean {
  return turn.turn % 2 === 0;
}

function isOdd(turn: Turn): boolean {
  return turn.turn % 2 === 1;
}

async function matchLifecycleV3(engine: GameEngine) {
  const matches = await listInProgressLiveMatches();

  for (const match of matches) {
    await checkAndUpdateMatch(engine, match);
  }
}

function getSupabaseMatchTimeControl(
  match: SupabaseMatch
): TimeControl | undefined {
  if (match.time_control_allowed_time && match.time_control_bonus) {
    return {
      time: match.time_control_allowed_time,
      bonus: match.time_control_bonus,
      variant: match.time_control_variant || undefined,
    };
  }

  return undefined;
}

function getMatchTimeControl(match: MatchV3): TimeControl | undefined {
  if (match.timeControlAllowedTime && match.timeControlBonus) {
    return {
      time: match.timeControlAllowedTime,
      bonus: match.timeControlBonus,
      variant: match.timeControlVariant || undefined,
    };
  }

  return undefined;
}

function getGameStartTimeMs(createdAt?: string) {
  return createdAt ? new Date(createdAt).getTime() : undefined;
}

async function checkAndUpdateMatch(engine: GameEngine, match: MatchV3) {
  const turns = pgnToTurns(match.pgn || "");
  console.log("checking and updating match", match.id, turns.length);

  const timeControl = getMatchTimeControl(match);

  const game = new GameClient({
    engine,
    isPassAndPlayMode: true,
    timeControl,
    gameStartTimeMs: getGameStartTimeMs(match.createdAt),
  });

  // Apply the historical moves to the game state
  try {
    for (const turn of turns) {
      game.pushTurn(turn);
    }
  } catch (error) {
    console.error("Error applying moves to game", error);
    return match;
  }

  const getWinnerId = (gameover: GameoverState) => {
    return gameover.winner
      ? gameover.winner === "RED"
        ? match.player0UserId
        : match.player1UserId
      : null;
  };

  // Check for gameover due to timeout or something already on the board.
  const gameoverDueToTimeout = game.gameover();
  if (gameoverDueToTimeout) {
    console.log("Updating match due to timeout", {
      id: match.id,
      gameover: gameoverDueToTimeout,
    });
    await updateMatchPGN(match.id, (match): SupabaseMatch => {
      return {
        ...match,
        status: gameoverDueToTimeout.status,
        winner_id: getWinnerId(gameoverDueToTimeout),
        gameover_reason: gameoverDueToTimeout.reason,
      };
    });
  }
}

import { TimeControl } from "@/game/constants";
import { Turn } from "@/game/engine-v2";
import { SendTurnRequest } from "@/lib/api";
import Router from "@koa/router";
import { Server } from "boardgame.io";
import { nanoid } from "nanoid";
import { PassThrough } from "stream";
import { MatchV3, MatchV3Info, User } from "@/lib/types";
import { createPGN, pgnToTurns } from "@/game/pgn";

interface Listener {
  id: string;
  stream: PassThrough;
  gameId: string;
  lastTurnIndex: number;
}

const gameIdsToListenerIds: Record<string, Set<string>> = {};
const listeners: Record<string, Listener> = {};

export function sendTurnsToListeners(
  gameId: string,
  turns: Turn[],
  turnIndex: number
) {
  const listenerIds = gameIdsToListenerIds[gameId];
  if (!listenerIds) {
    console.error("no listeners found for game", gameId);
    return;
  }
  // console.log("sending turns to listeners", listenerIds);

  for (const listenerId of listenerIds) {
    sendGameTurns(listenerId, turns, turnIndex);
  }
}

export function sendGameTurns(
  listenerId: string,
  turns: Turn[],
  turnIndex: number
) {
  const listener = listeners[listenerId];

  if (!listener) {
    console.error("listener is not initialized for client:", listenerId);
    return;
  }

  const data = {
    startIndex: turnIndex,
    turns,
  };

  // console.log("sending turns to listener", listenerId, {
  //   startIndex: turnIndex,
  //   turns,
  // });

  const formattedData = `data: ${JSON.stringify(data)}\n\n`;
  listener.stream.write(formattedData);

  listener.lastTurnIndex = turnIndex + turns.length;
}

async function sendInitialTurns(listenerId: string, gameId: string) {
  const game = matches[gameId as keyof typeof matches];
  if (!game) {
    return;
  }

  const turns = pgnToTurns(game.pgn);
  sendGameTurns(listenerId, turns, 0);
}

export function addGameServerRoutes(router: Router<any, Server.AppCtx>) {
  router.get("/v3/match/:id", async (ctx) => {
    const gameId = ctx.params.id as string;
    const game = matches[gameId as keyof typeof matches];
    if (!game) {
      ctx.throw(404, "Game not found");
      return;
    }
    const userId = ctx.state.auth.userId;
    const matchInfo = await getV3MatchInfo(gameId, userId);
    if (!matchInfo) {
      ctx.throw(404, "Game not found");
      return;
    }

    ctx.body = JSON.stringify(matchInfo);
  });

  router.get("/v3/match/:id/turns", async (ctx) => {
    const gameId = ctx.params.id as string;
    const game = matches[gameId as keyof typeof matches];
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

  router.post("/v3/match/:id/turns", (ctx) => {
    const id = ctx.params.id as string;
    const match = matches[id];
    if (!match) {
      ctx.throw(404, "Game not found");
      return;
    }

    const { turn, playerId, credentials } = ctx.request.body as SendTurnRequest;

    // TODO(tyler): verify credentials and playerId
    // TODO(tyler): validate that the turn can be applied onto the game successfully

    const turns = pgnToTurns(match.pgn);
    const turnIndex = turns.length;
    turns.push(turn);
    match.pgn = createPGN(turns);

    sendTurnsToListeners(id, [turn], turnIndex);

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

const matches: Record<string, MatchV3> = {};

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
  const match = {
    id: matchId,
    player0UserId: user0.id,
    player0Credentials: player0Creds,
    player1UserId: user1.id,
    player1Credentials: player1Creds,
    timeControlName,
    timeControlAllowedTime: timeControl.time,
    timeControlBonus: timeControl.bonus,
    timeControlVariant: timeControl.variant,
    rated,
    isCorrespondence,
    startingFen,
    pgn: "",
  };
  matches[matchId] = match;
}

export interface ActiveMatch {
  id: string;
  playerId: "0" | "1";
  credentials: string;
}

export async function getActiveV3Match(
  userId: string
): Promise<ActiveMatch | null> {
  for (const match of Object.values(matches)) {
    if (match.player0UserId === userId) {
      return {
        id: match.id,
        playerId: "0",
        credentials: match.player0Credentials,
      };
    }
    if (match.player1UserId === userId) {
      return {
        id: match.id,
        playerId: "1",
        credentials: match.player1Credentials,
      };
    }
  }
  return null;
}

export async function getV3MatchInfo(
  id: string,
  userId?: string
): Promise<MatchV3Info | null> {
  const match = matches[id as keyof typeof matches];
  if (!match) {
    return null;
  }

  if (userId) {
    const activeMatch = await getActiveV3Match(userId);
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

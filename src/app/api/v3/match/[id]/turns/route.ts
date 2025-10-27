import { NextRequest } from "next/server";
import { PassThrough } from "stream";
import { nanoid } from "nanoid";
import {
  fetchMatchV3,
  updateMatchPGN,
  deleteActiveMatches,
} from "@/server/matchv3-store";
import {
  addListener,
  removeListener,
  sendInitialTurns,
} from "@/server/sse-manager";
import { auth } from "@clerk/nextjs/server";
import { SendTurnRequest } from "@/lib/api";
import {
  isTurnAuthorized,
  getMatchTimeControl,
  getGameStartTimeMs,
} from "@/server/turn-processing";
import { GameClient } from "@/game/engine-v2";
import { getEngine } from "@/server/engine-singleton";
import { createPGN, pgnToTurns } from "@/game/pgn";
import { SupabaseMatch } from "@/server/supabase";
import { GameoverState } from "@/game/engine";
import { updateUserStats } from "@/server/user-stats";
import { getUser } from "@/lib/supabase";
import { calculateElo } from "@/game/elo";
import { updatePlayerElo } from "@/server/matchv3-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  const game = await fetchMatchV3(gameId);
  if (!game) {
    return new Response("Game not found", { status: 404 });
  }

  const listenerId = nanoid();
  const stream = new PassThrough();

  const readableStream = new ReadableStream({
    start(controller) {
      addListener(listenerId, {
        id: listenerId,
        stream,
        gameId,
        lastTurnIndex: 0,
      });

      stream.on("data", (chunk: Buffer) => {
        controller.enqueue(chunk);
      });

      stream.on("end", () => {
        controller.close();
      });

      stream.on("error", (error) => {
        console.error("Stream error:", error);
        controller.error(error);
      });

      sendInitialTurns(listenerId, gameId).catch((error) => {
        console.error("Error sending initial turns:", error);
      });
    },
    cancel() {
      stream.end();
      removeListener(listenerId);
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const match = await fetchMatchV3(id);
  if (!match) {
    return new Response("Game not found", { status: 404 });
  }

  const turnReq: SendTurnRequest = await request.json();

  if (!turnReq.credentials) {
    return new Response("Credentials are required", { status: 400 });
  }
  if (!turnReq.playerId) {
    return new Response("Player ID is required", { status: 400 });
  }
  if (!turnReq.turn) {
    return new Response("Turn is required", { status: 400 });
  }

  if (!(await isTurnAuthorized(userId, turnReq, match))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { turn } = turnReq;
  const engine = await getEngine();

  const updatedMatch = await updateMatchPGN(id, (match): SupabaseMatch => {
    const turns = pgnToTurns(match.pgn || "");

    const timeControl = getMatchTimeControl({
      timeControlAllowedTime: match.time_control_allowed_time,
      timeControlBonus: match.time_control_bonus,
      timeControlVariant: match.time_control_variant,
    } as any);

    const game = new GameClient({
      engine,
      isPassAndPlayMode: true,
      timeControl,
      gameStartTimeMs: getGameStartTimeMs(match?.created_at),
    });

    // Apply the historical moves to the game state
    try {
      for (const turn of turns) {
        game.pushTurn(turn);
      }
    } catch (error) {
      console.error("Error applying moves to game", error);
      throw new Error("Invalid move");
    }

    const getWinnerId = (gameover: GameoverState) => {
      return gameover.winner
        ? gameover.winner === "RED"
          ? match.player0_id
          : match.player1_id
        : null;
    };

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
      game.currentPlayerTurn() === "RED" ? match.player0_id : match.player1_id;

    return updatedMatch;
  });

  if (updatedMatch.status) {
    await deleteActiveMatches(updatedMatch.id);
    await updateUserElos(match);
  }

  return Response.json({ success: true });
}

async function updateUserElos(match: any): Promise<void> {
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
    updatePlayerElo(match.player0UserId, player0Elo),
    updatePlayerElo(match.player1UserId, player1Elo),
  ]);
}

import { TimeControl } from "@/game/constants";
import { GameClient, GameEngine, Turn } from "@/game/engine-v2";
import { nanoid } from "nanoid";
import { MatchV3, MatchV3Info, User } from "@/lib/types";
import { pgnToTurns } from "@/game/pgn";
import {
  createActiveMatches,
  createMatchV3,
  deleteActiveMatches,
  fetchMatchV3,
  getActiveMatch,
  listInProgressLiveMatches,
  updateMatchPGN,
  updatePlayerElo,
} from "./matchv3-store";
import { GameoverState } from "@/game/engine";
import { SupabaseMatch } from "./supabase";
import { updateUserStats } from "./user-stats";
import { getUser } from "@/lib/supabase";
import { calculateElo } from "@/game/elo";
import { allowedMoveToUci } from "@/game/notation-uci";
import {
  getMatchTimeControl,
  getGameStartTimeMs,
  hashCredentials,
} from "./turn-processing";
import { sendGameTurns, gameIdsToListenerIds } from "./sse-manager";

export function sendTurnsToListeners(gameId: string, turns: Turn[]) {
  const listenerIds = gameIdsToListenerIds[gameId];
  if (!listenerIds) {
    console.error("no listeners found for game", gameId);
    return;
  }

  for (const listenerId of listenerIds) {
    sendGameTurns(listenerId, turns);
  }
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

export interface ActiveMatch {
  id: string;
  playerId: "0" | "1";
  credentials: string;
}

export async function getV3MatchInfo(
  id: string,
  userId?: string | null
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

export function debugPrintGameState(game: GameClient, turn: Turn) {
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

export async function matchLifecycleV3(engine: GameEngine) {
  console.log("Running match lifecycle!");
  const matches = await listInProgressLiveMatches();

  for (const match of matches) {
    await checkAndUpdateMatch(engine, match);
  }
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
  if (!gameoverDueToTimeout) {
    return;
  }

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

  await deleteActiveMatches(match.id);
  await updateUserElos(match);
}

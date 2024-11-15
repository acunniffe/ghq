require("dotenv").config();

import { Server, Origins, FlatFile } from "boardgame.io/server";
import { GameoverState, GHQState, newOnlineGHQGame } from "./game/engine";
import { StorageAPI } from "boardgame.io";
import Koa from "koa";
import { createMatch } from "boardgame.io/src/server/util";
import { Game as SrcGame } from "boardgame.io/src/types"; // TODO(tyler): tech debt
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { PostgresStore } from "bgio-postgres";
import { calculateElo } from "./game/elo";
import cors from "@koa/cors";
import { authMiddleware, clerkClient } from "./server/auth";

const supabase = createClient(
  "https://wjucmtrnmjcaatbtktxo.supabase.co",
  process.env.SUPABASE_SECRET_KEY!
);

const ghqGame = newOnlineGHQGame({ onEnd: onGameEnd });

const db = new PostgresStore({
  database: "postgres",
  username: "postgres.wjucmtrnmjcaatbtktxo",
  password: process.env.POSTGRES_PASSWORD,
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 6543,
});

const server = Server({
  games: [ghqGame],
  origins: [Origins.LOCALHOST, "https://www.playghq.com"],
  db,
});

server.app.use(cors({ credentials: true }));
server.app.use(authMiddleware);

const QUEUE_STALE_MS = 10_000;
const queue: Map<string, number> = new Map();

server.router.post("/matchmaking", async (ctx) => {
  const userId = ctx.state.auth.userId;
  if (!userId) {
    throw new Error("userId is required");
  }

  // If user is already in a match, return the match id
  const activeMatch = await getActiveMatch(userId);
  if (activeMatch) {
    ctx.body = JSON.stringify({ match: activeMatch });
    return;
  }

  // If user isn't in the queue, or they are but we haven't heard from them in a while (stale), add them to the queue.
  const now = Date.now();
  const queuedUser = queue.get(userId);
  if (!queuedUser || queuedUser < now - QUEUE_STALE_MS) {
    console.log("Adding user to queue", userId);
    queue.set(userId, now);
    console.log("Users in queue", queue);
  }

  // TODO(tyler): more complex matchmaking logic
  // TODO(tyler): clean up stale live games

  if (queue.size >= 2) {
    const [player0, player1] = queue.keys();
    queue.delete(player0);
    queue.delete(player1);
    console.log("Creating match with players", player0, player1);

    const user0 = await getOrCreateUser(player0);
    const user1 = await getOrCreateUser(player1);

    const newMatch = await createNewMatch({
      ctx,
      db: server.db,
      player0,
      player1,
      numPlayers: 2,
      setupData: {
        players: {
          "0": player0,
          "1": player1,
        },
        elos: {
          "0": user0.elo,
          "1": user1.elo,
        },
      },
      unlisted: false,
      game: ghqGame as SrcGame,
    });
    if (!newMatch) {
      return;
    }
    const { matchId, player0Creds, player1Creds } = newMatch;
    await createActiveMatches({
      matchId,
      user0,
      user1,
      player0Creds,
      player1Creds,
    });

    ctx.body = JSON.stringify({});
    return;
  }

  ctx.body = JSON.stringify({});
});

server.router.delete("/matchmaking", (ctx) => {
  const userId = ctx.state.auth.userId;
  if (!userId) {
    throw new Error("userId is required");
  }

  queue.delete(userId);

  ctx.body = JSON.stringify({});
});

server.router.get("/matches", async (ctx) => {
  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, created_at, player0_id, player1_id, player0_elo, player1_elo, winner_id, status"
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (matchesError) {
    console.log({
      message: "Error fetching matches",
      matchesError,
    });
    ctx.body = JSON.stringify({ matches: [] });
    return;
  }

  const userIds = matchesData.flatMap((match) => [
    match.player0_id,
    match.player1_id,
  ]);

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username")
    .in("id", userIds);

  if (error) {
    console.log({
      message: "Error fetching users for matches",
      error,
    });
  }

  const matches: {
    id: string;
    player1: string;
    player1Elo: number;
    player2: string;
    player2Elo: number;
    winner: string | null;
    status: string;
    createdAt: string;
  }[] = [];

  if (users) {
    const userMap = new Map(
      users.map((user) => [user.id, user.username ?? "Anonymous"])
    );

    for (const match of matchesData) {
      matches.push({
        id: match.id,
        player1: userMap.get(match.player0_id),
        player2: userMap.get(match.player1_id),
        winner: userMap.get(match.winner_id) ?? null,
        player1Elo: match.player0_elo,
        player2Elo: match.player1_elo,
        status: match.status,
        createdAt: match.created_at,
      });
    }
  }

  ctx.body = JSON.stringify({ matches });
});

server.router.get("/matches/:matchId", async (ctx) => {
  const userId = ctx.state.auth.userId;

  const { data } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .eq("match_id", ctx.params.matchId)
    .single();

  // Return match credentials if the user is in the match actively.
  if (data) {
    const match = {
      id: data?.match_id || "",
      playerId: data?.player_id,
      credentials: data?.credentials,
    };

    ctx.body = JSON.stringify(match);
    return;
  }

  // Otherwise return general match info
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, player0_id, player1_id, player0_elo, player1_elo, winner_id, status"
    )
    .eq("id", ctx.params.matchId)
    .single();

  if (matchError) {
    console.log({
      message: "Error fetching match",
      matchError,
    });
    ctx.body = JSON.stringify({});
    return;
  }

  ctx.body = JSON.stringify(matchData);
});

server.router.delete("/matches/:matchId", async (ctx) => {
  const userId = ctx.state.auth.userId;
  const matchId = ctx.params.matchId;

  const { state } = await db.fetch(matchId, {
    state: true,
  });

  if (!state) {
    ctx.body = JSON.stringify({});
    return null;
  }

  // Ensure the calling user is authorized to abort this game
  const { error: findMatchError } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .eq("match_id", ctx.params.matchId)
    .single();
  if (findMatchError) {
    ctx.body = JSON.stringify({});
    return null;
  }

  const { error } = await supabase
    .from("active_user_matches")
    .delete()
    .eq("match_id", matchId);
  if (error) {
    console.log({
      message: "Error deleting active_user_matches",
      userId,
      matchId,
      error,
    });
    ctx.throw(400, "Error deleting active user match");
    return;
  }

  supabase
    .from("matches")
    .update({ status: "ABORTED" })
    .eq("id", matchId)
    .then(({ error }) => {
      if (error) {
        console.log({
          message: "Error updating matches table",
          matchId,
          error,
        });
      }
    });

  ctx.body = JSON.stringify({});
});

server.run(8000);

interface CreatedMatch {
  matchId: string;
  player0Creds: string;
  player1Creds: string;
}

const createNewMatch = async ({
  ctx,
  db,
  player0,
  player1,
  ...opts
}: {
  db: StorageAPI.Sync | StorageAPI.Async;
  player0: string;
  player1: string;
  ctx: Koa.BaseContext;
} & Parameters<typeof createMatch>[0]): Promise<CreatedMatch | null> => {
  const matchId = nanoid();

  opts.setupData.matchId = matchId;

  const match = createMatch(opts);

  if ("setupDataError" in match) {
    ctx.throw(400, match.setupDataError);
    return null;
  } else {
    // @ts-expect-error: not sure yet
    await db.createMatch(matchId, match);

    const { metadata } = await db.fetch(matchId, {
      metadata: true,
    });
    if (!metadata) {
      ctx.throw(404, "Match " + matchId + " not found");
      return null;
    }

    const player0Creds = nanoid();
    const player1Creds = nanoid();

    metadata.players["0"].name = player0;
    metadata.players["0"].credentials = player0Creds;
    metadata.players["1"].name = player1;
    metadata.players["1"].credentials = player1Creds;

    await db.setMetadata(matchId, metadata);

    return { matchId, player0Creds, player1Creds };
  }
};

async function createActiveMatches({
  matchId,
  user0,
  user1,
  player0Creds,
  player1Creds,
}: {
  matchId: string;
  user0: User;
  user1: User;
  player0Creds: string;
  player1Creds: string;
}): Promise<void> {
  const { error } = await supabase.from("active_user_matches").insert([
    {
      user_id: user0.id,
      match_id: matchId,
      player_id: "0",
      credentials: player0Creds,
    },
    {
      user_id: user1.id,
      match_id: matchId,
      player_id: "1",
      credentials: player1Creds,
    },
  ]);
  if (error) throw error;

  const { error: matchError } = await supabase.from("matches").insert([
    {
      id: matchId,
      player0_id: user0.id,
      player1_id: user1.id,
      player0_elo: user0.elo,
      player1_elo: user1.elo,
    },
  ]);
  if (matchError) throw matchError;
}

interface ActiveMatch {
  id: string;
  playerId: "0" | "1";
  credentials: string;
}

async function getActiveMatch(userId: string): Promise<ActiveMatch | null> {
  const { data, error } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .single();
  if (error) return null;

  return {
    id: data?.match_id || "",
    playerId: data?.player_id,
    credentials: data?.credentials,
  };
}

function onGameEnd({ ctx, G }: { ctx: any; G: GHQState }): void | GHQState {
  const matchId = G.matchId;
  for (const userId of Object.values(G.userIds)) {
    supabase
      .from("active_user_matches")
      .delete()
      .eq("user_id", userId)
      .eq("match_id", matchId)
      .then(({ data, error }) => {
        if (error)
          console.log({
            message: "Error deleting active_user_matches",
            userId,
            matchId,
            error,
          });
      });
  }

  const { status, winner } = ctx.gameover as GameoverState;
  const player0Id = G.userIds["0"];
  const player1Id = G.userIds["1"];
  const winnerId =
    status === "WIN" ? (winner === "RED" ? player0Id : player1Id) : null;

  // Update match with winner and status
  supabase
    .from("matches")
    .update({ winner_id: winnerId, status })
    .eq("id", matchId)
    .then(({ error }) => {
      if (error) {
        console.log({
          message: "Error updating matches table",
          matchId,
          winnerId,
          status,
          error,
        });
      }
    });

  // Update user elos

  const player0Elo = calculateElo(
    G.elos["0"],
    G.elos["1"],
    status === "DRAW" ? 0.5 : winner === "RED" ? 1 : 0
  );

  supabase
    .from("users")
    .update({ elo: player0Elo })
    .eq("id", player0Id)
    .then(({ error }) => {
      if (error) {
        console.log({
          message: "Error updating winner's elo",
          winnerId,
          error,
        });
      }
    });

  const player1Elo = calculateElo(
    G.elos["1"],
    G.elos["0"],
    status === "DRAW" ? 0.5 : winner === "BLUE" ? 1 : 0
  );

  supabase
    .from("users")
    .update({ elo: player1Elo })
    .eq("id", player1Id)
    .then(({ error }) => {
      if (error) {
        console.log({
          message: "Error updating loser's elo",
          player1Id,
          error,
        });
      }
    });
}

interface User {
  id: string;
  elo: number;
  username: string;
}

async function getOrCreateUser(userId: string): Promise<User> {
  const clerkUser = await clerkClient.users.getUser(userId);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, elo")
    .eq("id", userId)
    .single();

  if (user) {
    if (user.username !== clerkUser.username) {
      await supabase
        .from("users")
        .update({ username: clerkUser.username })
        .eq("id", userId);
    }

    return user;
  }

  if (userError && userError.code === "PGRST116") {
    const newUser = {
      id: userId,
      elo: 1000,
      username: clerkUser.username ?? "Anonymous",
    };
    const { error: insertError } = await supabase
      .from("users")
      .insert([newUser]);

    if (insertError) throw insertError;
    return newUser;
  } else if (userError) {
    throw userError;
  }

  throw new Error("Unexpected error");
}

server.router.get("/leaderboard", async (ctx) => {
  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, elo")
    .order("elo", { ascending: false })
    .limit(10);

  if (error) {
    console.log({
      message: "Error fetching users for matches",
      error,
    });
    ctx.throw(400, "Error fetching users");
  }

  ctx.body = JSON.stringify({ users });
});

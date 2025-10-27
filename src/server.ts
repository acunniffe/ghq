require("dotenv").config();

import { Server, Origins, FlatFile } from "boardgame.io/server";
import {
  GameoverState,
  GHQState,
  newOnlineGHQGame,
  Player,
} from "./game/engine";
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
import { TIME_CONTROLS } from "./game/constants";
import { matchLifecycle } from "./server/match-lifecycle";
import bodyParser from "koa-bodyparser";
import { MatchModel, User } from "./lib/types";
import {
  addUserToOnlineUsers,
  getUsersOnlineResponse,
  userLifecycle,
} from "./server/user-lifecycle";
import { removeUserFromAllQueues, getQueue } from "./server/matchmaking";
import { getUser } from "./lib/supabase";
import { getMatchSummary } from "./server/match-summary";
import { updateUserStats } from "./server/user-stats";
import { getUserSummary } from "./server/user-summary";
import { getActivePlayersInLast30Days, listMatches } from "./server/matches";
import { createNewV3Match } from "./server/game-server";
import { loadV2Engine } from "./server/engine";

async function runServer() {
  const supabase = createClient(
    "https://wjucmtrnmjcaatbtktxo.supabase.co",
    process.env.SUPABASE_SECRET_KEY!
  );

  const ghqGame = newOnlineGHQGame({ onEnd: onGameEnd });
  const v2Engine = await loadV2Engine();

  const db = new PostgresStore({
    database: "postgres",
    username: "postgres.wjucmtrnmjcaatbtktxo",
    password: process.env.POSTGRES_PASSWORD,
    host: "aws-0-us-east-2.pooler.supabase.com",
    port: 6543,
    logging: process.env.NODE_ENV !== "production",
  });

  const server = Server({
    games: [ghqGame],
    origins: [Origins.LOCALHOST, "https://www.playghq.com"],
    db,
  });

  server.app.use(cors({ credentials: true }));
  server.app.use(bodyParser());
  server.app.use(authMiddleware);

  const QUEUE_STALE_MS = 5_000;

  const DEFAULT_TIME_CONTROL = "rapid";

  const runMatchLifecycle = () => {
    matchLifecycle({ supabase, db: server.db, onGameEnd }).finally(() => {
      setTimeout(runMatchLifecycle, 10_000);
    });
  };

  if (process.env.NODE_ENV !== "development") {
    runMatchLifecycle();
  }

  server.router.post("/matchmaking", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const mode = (ctx.request.query.mode as string) ?? DEFAULT_TIME_CONTROL;
    if (!(mode in TIME_CONTROLS)) {
      ctx.throw(400, "Invalid time control");
      return;
    }
    const timeControl = TIME_CONTROLS[mode as keyof typeof TIME_CONTROLS];

    // default to true if its not specified for now (we'll change this later)
    const rated =
      ctx.request.query.rated === undefined
        ? true
        : (ctx.request.query.rated as string) === "true";

    // If user is already in a match, return the match id
    const activeMatch = await getActiveMatch(userId);
    if (activeMatch) {
      ctx.body = JSON.stringify({ match: activeMatch });
      return;
    }

    const queue = getQueue(mode, rated);

    // Iterate through the queue and remove stale users
    const now = Date.now();
    for (const [userId, lastActive] of queue.entries()) {
      if (lastActive < Date.now() - QUEUE_STALE_MS) {
        console.log(`Removing stale user from ${mode} queue`, userId);
        queue.delete(userId);
      }
    }

    // Refresh the user in the queue
    queue.set(userId, now);

    // TODO(tyler): more complex matchmaking logic
    // TODO(tyler): clean up stale live games

    if (queue.size >= 2) {
      const [firstPlayer, secondPlayer] = queue.keys();
      queue.delete(firstPlayer);
      queue.delete(secondPlayer);

      const isRandomFirst = Math.random() < 0.5;
      const player0 = isRandomFirst ? firstPlayer : secondPlayer;
      const player1 = isRandomFirst ? secondPlayer : firstPlayer;

      console.log("Creating match with players", player0, player1, rated);

      const user0 = await getOrCreateUser(player0);
      const user1 = await getOrCreateUser(player1);

      // NB(tyler): For now, we only support V3 matches for unrated games.
      if (!rated) {
        await createNewV3Match({
          user0,
          user1,
          timeControlName: mode,
          timeControl,
          isCorrespondence: false,
          rated,
        });
        ctx.body = JSON.stringify({});
        return;
      }

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
          timeControl: timeControl.time,
          bonusTime: timeControl.bonus,
          variant: timeControl?.variant,
          rated,
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
        isCorrespondence: false,
        rated,
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

    removeUserFromAllQueues(userId);

    ctx.body = JSON.stringify({});
  });

  server.router.get("/matches", async (ctx) => {
    const userId = (ctx.request.query.userId as string) ?? undefined;
    const isCorrespondence =
      (ctx.request.query.isCorrespondence as string) === "true";

    const matches = await listMatches({
      supabase,
      userId,
      isCorrespondence,
    });
    ctx.body = JSON.stringify({ matches });
  });

  server.router.get("/matches/:matchId", async (ctx) => {
    const userId = ctx.state.auth.userId;

    // Fetch general match info
    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, player0_id, player1_id, player0_elo, player1_elo, winner_id, status, rated"
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

    const { data } = await supabase
      .from("active_user_matches")
      .select("match_id, player_id, credentials")
      .eq("user_id", userId)
      .eq("match_id", ctx.params.matchId)
      .single();

    // Return match credentials if the user is in the match actively.
    if (data) {
      const match = {
        ...matchData,
        id: data?.match_id || "",
        playerId: data?.player_id,
        credentials: data?.credentials,
      };

      ctx.body = JSON.stringify(match);
      return;
    }

    ctx.body = JSON.stringify(matchData);
  });

  server.router.delete("/matches/:matchId", async (ctx) => {
    const userId = ctx.state.auth.userId;
    const matchId = ctx.params.matchId;

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
    rated,
    isCorrespondence = false,
  }: {
    matchId: string;
    user0: User;
    user1: User;
    player0Creds: string;
    player1Creds: string;
    rated: boolean;
    isCorrespondence: boolean;
  }): Promise<void> {
    const { error } = await supabase.from("active_user_matches").insert([
      {
        user_id: user0.id,
        match_id: matchId,
        player_id: "0",
        credentials: player0Creds,
        is_correspondence: isCorrespondence,
      },
      {
        user_id: user1.id,
        match_id: matchId,
        player_id: "1",
        credentials: player1Creds,
        is_correspondence: isCorrespondence,
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
        current_turn_player_id: user0.id,
        is_correspondence: isCorrespondence,
        rated,
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
      .eq("is_correspondence", false) // distinguish between live and correspondence, correspondence allows multiple simultaneous games
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

    updateUserElos({
      player0Id,
      player1Id,
      status,
      winner,
      winnerId,
      matchId,
    }).catch((error) => {
      console.log({
        message: "Error updating user elos",
        error,
      });
    });
  }

  async function updateUserElos({
    player0Id,
    player1Id,
    status,
    winner,
    winnerId,
    matchId,
  }: {
    player0Id: string;
    player1Id: string;
    status: string;
    winner: Player | undefined;
    winnerId: string | null;
    matchId: string;
  }): Promise<void> {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, rated")
      .eq("id", matchId)
      .single();

    if (matchError) {
      console.log({
        message: "Error fetching match",
        matchId,
        matchError,
      });
      return;
    }

    if (!match.rated) {
      console.log("Unrated match, skipping elo update");
      return;
    }

    const [player0, player1] = await Promise.all([
      getUser(player0Id),
      getUser(player1Id),
    ]);

    updateUserStats(player0);
    const player0Elo = calculateElo(
      player0.elo,
      player1.elo,
      status === "DRAW" ? 0.5 : winner === "RED" ? 1 : 0
    );

    updateUserStats(player1);
    const player1Elo = calculateElo(
      player1.elo,
      player0.elo,
      status === "DRAW" ? 0.5 : winner === "BLUE" ? 1 : 0
    );

    const updatePlayer = (player: User, elo: number) => {
      supabase
        .from("users")
        .update({
          elo,
          gamesThisMonth: player.gamesThisMonth || 0,
          badge: player.badge || null,
        })
        .eq("id", player.id)
        .then(({ error }) => {
          if (error) {
            console.log({
              message: "Error updating winner's elo",
              winnerId,
              error,
            });
          }
        });
    };

    updatePlayer(player0, player0Elo);
    updatePlayer(player1, player1Elo);
  }

  async function getOrCreateUser(userId: string): Promise<User> {
    const clerkUser = await clerkClient.users.getUser(userId);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, elo")
      .eq("id", userId)
      .single();

    if (user) {
      if (
        // If clerk username is set and it's different from the username in the database, update the username
        (clerkUser.username && user.username !== clerkUser.username) ||
        // If the username in the database is null, update it to a random default
        !user.username
      ) {
        const username = clerkUsernameOrRandomDefault(clerkUser.username);
        const { error } = await supabase
          .from("users")
          .update({ username })
          .eq("id", userId);

        if (!error) {
          user.username = username;
        }
      }

      return user;
    }

    if (userError && userError.code === "PGRST116") {
      const newUser = {
        id: userId,
        elo: 1000,
        username: clerkUsernameOrRandomDefault(clerkUser.username),
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
      .select("id, username, elo, gamesThisMonth, badge")
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

  server.router.get("/match-summary", async (ctx) => {
    try {
      const result = await getMatchSummary(supabase);
      ctx.body = JSON.stringify(result);
    } catch (error) {
      ctx.throw(
        400,
        error instanceof Error ? error.message : "Error fetching match summary"
      );
    }
  });

  server.router.get("/users", async (ctx) => {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, elo")
      .neq("username", "Anonymous")
      .neq("username", "")
      .order("username", { ascending: true });

    if (error) {
      console.log({
        message: "Error fetching users",
        error,
      });
      ctx.throw(400, "Error fetching users");
    }

    ctx.body = JSON.stringify({ users });
  });

  server.router.put("/users/me/username", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const user = await getOrCreateUser(userId);

    ctx.body = JSON.stringify({ user });
  });

  server.router.get("/correspondence/matches", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const matches = await listMatches({
      supabase,
      userId,
      isCorrespondence: true,
    });
    ctx.body = JSON.stringify({ matches });
  });

  server.router.post("/correspondence/challenge", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const { targetUserId, rated, fen } = ctx.request.body as {
      targetUserId: string;
      rated?: boolean;
      fen?: string;
    };
    if (!targetUserId) {
      ctx.throw(400, "targetUserId is required");
    }

    const { data: challenge, error } = await supabase
      .from("correspondence_challenges")
      .insert({
        challenger_user_id: userId,
        target_user_id: targetUserId,
        status: "sent",
        rated: rated ?? true, // default to true if its not specified for now (we'll change this later)
        fen,
      })
      .select()
      .single();

    if (error) {
      console.log({
        message: "Error creating correspondence challenge",
        error,
      });
      ctx.throw(400, "Error creating challenge");
    }

    ctx.body = JSON.stringify({ challenge });
  });

  server.router.get("/correspondence/challenges", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const { data: challenges, error } = await supabase
      .from("correspondence_challenges")
      .select(
        `
      challenger:users!challenger_user_id(id, username, elo),
      target:users!target_user_id(id, username, elo),
      rated,
      fen,
      created_at
    `
      )
      .or(`challenger_user_id.eq.${userId},target_user_id.eq.${userId}`)
      .eq("status", "sent")
      .order("created_at", { ascending: false });

    if (error) {
      console.log({
        message: "Error fetching correspondence challenges",
        error,
      });
      ctx.throw(400, "Error fetching challenges");
    }

    ctx.body = JSON.stringify({ challenges });
  });

  server.router.post("/correspondence/accept", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const { challengerUserId } = ctx.request.body as {
      challengerUserId: string;
    };
    if (!challengerUserId) {
      ctx.throw(400, "challengerUserId is required");
    }

    const { data: challenge, error: challengeError } = await supabase
      .from("correspondence_challenges")
      .select("challenger_user_id, target_user_id, rated, fen")
      .eq("challenger_user_id", challengerUserId)
      .eq("target_user_id", userId)
      .eq("status", "sent")
      .single();

    if (challengeError || !challenge) {
      ctx.throw(400, "Invalid challenge");
      return;
    }

    const isRandomFirst = Math.random() < 0.5;

    const user0 = await getOrCreateUser(
      isRandomFirst ? challenge.challenger_user_id : userId
    );
    const user1 = await getOrCreateUser(
      isRandomFirst ? userId : challenge.challenger_user_id
    );

    if (!challenge.rated) {
      await createNewV3Match({
        user0,
        user1,
        timeControlName: "correspondence",
        timeControl: TIME_CONTROLS.correspondence,
        isCorrespondence: true,
        rated: challenge.rated,
        startingFen: challenge.fen,
      });
      const { error: updateError } = await supabase
        .from("correspondence_challenges")
        .delete()
        .eq("challenger_user_id", challengerUserId)
        .eq("target_user_id", userId);

      if (updateError) {
        console.log({
          message: "Error updating challenge status",
          error: updateError,
        });
        ctx.throw(400, "Error accepting challenge");
      }
      ctx.body = JSON.stringify({});
      return;
    }

    const newMatch = await createNewMatch({
      ctx,
      db: server.db,
      player0: challenge.challenger_user_id,
      player1: userId,
      numPlayers: 2,
      setupData: {
        players: {
          "0": user0.id,
          "1": user1.id,
        },
        elos: {
          "0": user0.elo,
          "1": user1.elo,
        },
        timeControl: TIME_CONTROLS.correspondence.time,
        bonusTime: TIME_CONTROLS.correspondence.bonus,
        fen: challenge.fen,
      },
      unlisted: false,
      game: ghqGame as SrcGame,
    });

    if (!newMatch) {
      ctx.throw(400, "Failed to create match");
      return;
    }

    const { matchId, player0Creds, player1Creds } = newMatch;

    await createActiveMatches({
      matchId,
      user0,
      user1,
      player0Creds,
      player1Creds,
      isCorrespondence: true,
      rated: challenge.rated,
    });

    const { error: updateError } = await supabase
      .from("correspondence_challenges")
      .delete()
      .eq("challenger_user_id", challengerUserId)
      .eq("target_user_id", userId);

    if (updateError) {
      console.log({
        message: "Error updating challenge status",
        error: updateError,
      });
      ctx.throw(400, "Error accepting challenge");
    }

    ctx.body = JSON.stringify({ matchId });
  });

  server.router.get("/correspondence/random-user", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    // Get this user's active correspondence matches
    const { data: myMatches, error: myMatchesError } = await supabase
      .from("matches")
      .select("id, player0_id, player1_id, status, is_correspondence")
      .eq("is_correspondence", true)
      .is("status", null)
      .or(`player0_id.eq.${userId},player1_id.eq.${userId}`);

    if (myMatchesError) {
      console.log({
        message: "Error fetching my matches",
        myMatchesError,
      });
      ctx.throw(400, "Error fetching my matches");
      return;
    }

    const myMatchesUserIds = new Set<string>();
    for (const match of myMatches) {
      myMatchesUserIds.add(match.player0_id);
      myMatchesUserIds.add(match.player1_id);
    }

    // Get all active players in the last 30 days and filter out the players that are in the user's matches
    const activePlayers = await getActivePlayersInLast30Days({ supabase });
    const filteredActivePlayers = activePlayers.filter(
      (player) => !myMatchesUserIds.has(player)
    );

    const randomPlayer =
      filteredActivePlayers[
        Math.floor(Math.random() * filteredActivePlayers.length)
      ];

    const user = await getUser(randomPlayer);

    ctx.body = JSON.stringify({ user });
  });

  function clerkUsernameOrRandomDefault(username?: string | null): string {
    if (username && username.length > 0) {
      return username;
    }

    const adjectives = [
      "Brave",
      "Clever",
      "Dazzling",
      "Energetic",
      "Fierce",
      "Glorious",
      "Happy",
      "Incredible",
      "Jolly",
      "Keen",
      "Luminous",
      "Mighty",
      "Noble",
      "Optimistic",
      "Powerful",
      "Quirky",
      "Radiant",
      "Spectacular",
      "Terrific",
      "Unstoppable",
      "Vibrant",
      "Wonderful",
      "Excellent",
      "Youthful",
      "Zealous",
    ];

    const nouns = [
      "Panda",
      "Tiger",
      "Dragon",
      "Phoenix",
      "Wizard",
      "Knight",
      "Ninja",
      "Pirate",
      "Robot",
      "Astronaut",
      "Dinosaur",
      "Unicorn",
      "Warrior",
      "Explorer",
      "Hero",
      "Falcon",
      "Dolphin",
      "Lion",
      "Wolf",
      "Eagle",
      "Shark",
      "Titan",
      "Champion",
      "Voyager",
      "Ranger",
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);

    return `${adjective}${noun}${number}`;
  }

  server.router.get("/users/online", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    addUserToOnlineUsers(userId);

    ctx.body = JSON.stringify(getUsersOnlineResponse());
  });

  server.router.get("/users/:userId", async (ctx) => {
    const userId = ctx.state.auth.userId;
    if (!userId) {
      throw new Error("userId is required");
    }

    const user = await getUserSummary(supabase, ctx.params.userId);

    ctx.body = JSON.stringify({ user });
  });
}

runServer().catch(console.error);

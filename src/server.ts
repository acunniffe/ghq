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
import { addGameServerRoutes, createNewV3Match } from "./server/game-server";
import { loadV2Engine } from "./server/engine";

async function runServer() {
  const supabase = createClient(
    "https://wjucmtrnmjcaatbtktxo.supabase.co",
    process.env.SUPABASE_SECRET_KEY!
  );

  const v2Engine = await loadV2Engine();

  setInterval(() => {
    userLifecycle({ supabase, db: server.db });
  }, 5_000);

  addGameServerRoutes(server.router, v2Engine);

  server.run(8000);
}

runServer().catch(console.error);

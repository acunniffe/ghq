import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getV3MatchInfo,
  matchLifecycleV3,
  sendTurnsToListeners,
} from "@/server/game-server";
import { onMatchChange } from "@/server/matchv3-store";
import { pgnToTurns } from "@/game/pgn";
import { getEngine } from "@/server/engine-singleton";

// export const runtime = "edge";

onMatchChange((match) => {
  const turns = pgnToTurns(match.pgn);
  sendTurnsToListeners(match.id, turns);
});

const runMatchLifecycle = async () => {
  const engine = await getEngine();
  matchLifecycleV3(engine).finally(() => {
    setTimeout(runMatchLifecycle, 10_000);
  });
};

if (process.env.NODE_ENV !== "development") {
  runMatchLifecycle();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;
  const { userId } = await auth();

  const matchInfo = await getV3MatchInfo(gameId, userId);

  if (!matchInfo) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(matchInfo);
}

import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getQueue, removeUserFromAllQueues } from "@/server/matchmaking";
import { getActiveMatch, getOrCreateUser } from "@/server/user-management";
import { createNewV3Match } from "@/server/game-server";
import { TIME_CONTROLS } from "@/game/constants";

export const dynamic = "force-dynamic";

const QUEUE_STALE_MS = 5_000;
const DEFAULT_TIME_CONTROL = "rapid";

export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode") ?? DEFAULT_TIME_CONTROL;

  if (!(mode in TIME_CONTROLS)) {
    return NextResponse.json(
      { error: "Invalid time control" },
      { status: 400 }
    );
  }

  const timeControl = TIME_CONTROLS[mode as keyof typeof TIME_CONTROLS];

  // default to true if its not specified for now (we'll change this later)
  const rated =
    searchParams.get("rated") === null
      ? true
      : searchParams.get("rated") === "true";

  // If user is already in a match, return the match id
  const activeMatch = await getActiveMatch(supabase, userId);
  if (activeMatch) {
    return NextResponse.json({ match: activeMatch });
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

    const user0 = await getOrCreateUser(supabase, player0);
    const user1 = await getOrCreateUser(supabase, player1);

    await createNewV3Match({
      user0,
      user1,
      timeControlName: mode,
      timeControl,
      isCorrespondence: false,
      rated,
    });
    return NextResponse.json({});
  }

  return NextResponse.json({});
}

export async function DELETE() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  removeUserFromAllQueues(userId);

  return NextResponse.json({});
}

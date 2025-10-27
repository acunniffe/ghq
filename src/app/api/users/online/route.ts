import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  addUserToOnlineUsers,
  getUsersOnlineResponse,
  userLifecycle,
} from "@/server/user-lifecycle";
import { getAdminSupabase } from "@/lib/supabase-server";

export const runtime = "edge";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  addUserToOnlineUsers(userId);

  maybeRunUserLifecycle();

  return NextResponse.json(getUsersOnlineResponse());
}

let lastRunTime = 0;
const LIFECYCLE_INTERVAL_MS = 5_000;

export async function maybeRunUserLifecycle(): Promise<void> {
  const now = Date.now();

  if (now - lastRunTime < LIFECYCLE_INTERVAL_MS) {
    return;
  }

  lastRunTime = now;

  userLifecycle({ supabase: getAdminSupabase() }).catch((error) => {
    console.error("Error running user lifecycle:", error);
  });
}

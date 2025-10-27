import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  addUserToOnlineUsers,
  getUsersOnlineResponse,
} from "@/server/user-lifecycle";

export const runtime = "edge";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  addUserToOnlineUsers(userId);

  // TODO(tyler): this isn't going to work until we have user lifecycle in next.js to

  return NextResponse.json(getUsersOnlineResponse());
}

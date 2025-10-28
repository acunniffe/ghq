import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getV3MatchInfo } from "@/server/game-server";

export const dynamic = "force-dynamic";

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

import { getAdminSupabase } from "@/lib/supabase-server";
import { listMatches } from "@/server/matches";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = await listMatches({
    supabase,
    userId,
    isCorrespondence: true,
  });

  return NextResponse.json({ matches });
}

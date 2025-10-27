import { getAdminSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { listMatches } from "@/server/matches";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const supabase = getAdminSupabase();
  const searchParams = request.nextUrl.searchParams;

  const userId = searchParams.get("userId") ?? undefined;
  const isCorrespondence = searchParams.get("isCorrespondence") === "true";

  const matches = await listMatches({
    supabase,
    userId,
    isCorrespondence,
  });

  return NextResponse.json({ matches });
}

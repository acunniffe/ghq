import { getAdminSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getMatchSummary } from "@/server/match-summary";

export const runtime = "edge";

export async function GET() {
  const supabase = getAdminSupabase();

  try {
    const result = await getMatchSummary(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error fetching match summary",
      },
      { status: 400 }
    );
  }
}

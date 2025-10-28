import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Error fetching challenges" },
      { status: 400 }
    );
  }

  return NextResponse.json({ challenges });
}

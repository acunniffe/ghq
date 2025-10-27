import { getAdminSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const supabase = getAdminSupabase();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, elo, gamesThisMonth, badge")
    .order("elo", { ascending: false })
    .limit(10);

  if (error) {
    console.log({
      message: "Error fetching users for matches",
      error,
    });
    return NextResponse.json(
      { error: "Error fetching users" },
      { status: 400 }
    );
  }

  return NextResponse.json({ users });
}

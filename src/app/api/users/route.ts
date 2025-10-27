import { getAdminSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const supabase = getAdminSupabase();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, elo")
    .neq("username", "Anonymous")
    .neq("username", "")
    .order("username", { ascending: true });

  if (error) {
    console.log({
      message: "Error fetching users",
      error,
    });
    return NextResponse.json(
      { error: "Error fetching users" },
      { status: 400 }
    );
  }

  return NextResponse.json({ users });
}

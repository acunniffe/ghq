import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await params;

  const { error: findMatchError } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .single();

  if (findMatchError) {
    return NextResponse.json({});
  }

  const { error } = await supabase
    .from("active_user_matches")
    .delete()
    .eq("match_id", matchId);

  if (error) {
    console.log({
      message: "Error deleting active_user_matches",
      userId,
      matchId,
      error,
    });
    return NextResponse.json(
      { error: "Error deleting active user match" },
      { status: 400 }
    );
  }

  supabase
    .from("matches")
    .update({ status: "ABORTED" })
    .eq("id", matchId)
    .then(({ error }) => {
      if (error) {
        console.log({
          message: "Error updating matches table",
          matchId,
          error,
        });
      }
    });

  return NextResponse.json({});
}

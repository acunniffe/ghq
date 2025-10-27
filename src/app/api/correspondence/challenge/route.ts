import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetUserId, rated, fen } = await request.json();

  if (!targetUserId) {
    return NextResponse.json(
      { error: "targetUserId is required" },
      { status: 400 }
    );
  }

  const { data: challenge, error } = await supabase
    .from("correspondence_challenges")
    .insert({
      challenger_user_id: userId,
      target_user_id: targetUserId,
      status: "sent",
      rated: rated ?? true,
      fen,
    })
    .select()
    .single();

  if (error) {
    console.log({
      message: "Error creating correspondence challenge",
      error,
    });
    return NextResponse.json(
      { error: "Error creating challenge" },
      { status: 400 }
    );
  }

  return NextResponse.json({ challenge });
}

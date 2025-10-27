import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/server/user-management";
import { createNewV3Match } from "@/server/game-server";
import { TIME_CONTROLS } from "@/game/constants";

export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { challengerUserId } = await request.json();

  if (!challengerUserId) {
    return NextResponse.json(
      { error: "challengerUserId is required" },
      { status: 400 }
    );
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("correspondence_challenges")
    .select("challenger_user_id, target_user_id, rated, fen")
    .eq("challenger_user_id", challengerUserId)
    .eq("target_user_id", userId)
    .eq("status", "sent")
    .single();

  if (challengeError || !challenge) {
    return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
  }

  const isRandomFirst = Math.random() < 0.5;

  const user0 = await getOrCreateUser(
    supabase,
    isRandomFirst ? challenge.challenger_user_id : userId
  );
  const user1 = await getOrCreateUser(
    supabase,
    isRandomFirst ? userId : challenge.challenger_user_id
  );

  await createNewV3Match({
    user0,
    user1,
    timeControlName: "correspondence",
    timeControl: TIME_CONTROLS.correspondence,
    isCorrespondence: true,
    rated: challenge.rated,
    startingFen: challenge.fen,
  });

  const { error: updateError } = await supabase
    .from("correspondence_challenges")
    .delete()
    .eq("challenger_user_id", challengerUserId)
    .eq("target_user_id", userId);

  if (updateError) {
    console.log({
      message: "Error updating challenge status",
      error: updateError,
    });
    return NextResponse.json(
      { error: "Error accepting challenge" },
      { status: 400 }
    );
  }

  return NextResponse.json({});
}

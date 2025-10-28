import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getActivePlayersInLast30Days } from "@/server/matches";
import { getUser } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: myMatches, error: myMatchesError } = await supabase
    .from("matches")
    .select("id, player0_id, player1_id, status, is_correspondence")
    .eq("is_correspondence", true)
    .is("status", null)
    .or(`player0_id.eq.${userId},player1_id.eq.${userId}`);

  if (myMatchesError) {
    console.log({
      message: "Error fetching my matches",
      myMatchesError,
    });
    return NextResponse.json(
      { error: "Error fetching my matches" },
      { status: 400 }
    );
  }

  const myMatchesUserIds = new Set<string>();
  for (const match of myMatches) {
    myMatchesUserIds.add(match.player0_id);
    myMatchesUserIds.add(match.player1_id);
  }

  const activePlayers = await getActivePlayersInLast30Days({ supabase });
  const filteredActivePlayers = activePlayers.filter(
    (player) => !myMatchesUserIds.has(player)
  );

  const randomPlayer =
    filteredActivePlayers[
      Math.floor(Math.random() * filteredActivePlayers.length)
    ];

  const user = await getUser(randomPlayer);

  return NextResponse.json({ user });
}

import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserSummary } from "@/server/user-summary";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;
  const user = await getUserSummary(supabase, targetUserId);

  return NextResponse.json({ user });
}

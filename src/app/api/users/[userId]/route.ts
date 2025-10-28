import { getAdminSupabase } from "@/lib/supabase-server";
import { getUserSummary } from "@/server/user-summary";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = getAdminSupabase();
  const { userId: authUserId } = await auth();

  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const user = await getUserSummary(supabase, userId);

  return NextResponse.json({ user });
}

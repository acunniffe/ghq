import { getAdminSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/server/user-management";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function PUT() {
  const supabase = getAdminSupabase();
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateUser(supabase, userId);

  return NextResponse.json({ user });
}

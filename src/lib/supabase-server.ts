import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function getAdminSupabase(): SupabaseClient {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(
    "https://wjucmtrnmjcaatbtktxo.supabase.co",
    process.env.SUPABASE_SECRET_KEY!
  );
}

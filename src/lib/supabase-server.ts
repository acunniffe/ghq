import { createClient } from "@supabase/supabase-js";

export function getAdminSupabase() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(
    "https://wjucmtrnmjcaatbtktxo.supabase.co",
    supabaseServiceRoleKey
  );
}

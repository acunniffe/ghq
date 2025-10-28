import { createClient } from "@supabase/supabase-js";

export function getAdminSupabase() {
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(
    "https://wjucmtrnmjcaatbtktxo.supabase.co",
    supabaseSecretKey
  );
}

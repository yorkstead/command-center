import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Bypasses row-level security. Only the calendar sync uses it (lib/calendar/),
 * because Google's pings and the nightly job arrive without a signed-in person.
 * Pages and Server Actions use lib/supabase/server.ts instead.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

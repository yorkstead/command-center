import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./db/types";

/**
 * The signed-in team member and the whole team, for any page or action.
 * Signed out goes to /login; signed in but not on the team goes to /login with a note.
 */
export const requireMember = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: team } = await supabase
    .from("profiles")
    .select("id, display_name, initials, email, is_active")
    .eq("is_active", true)
    .order("display_name");

  const members = (team ?? []) as Profile[];
  const me = members.find((m) => m.id === userId);
  if (!me) redirect("/login?error=not-on-team");

  return { supabase, me, team: members };
});

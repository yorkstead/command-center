"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: "Enter a valid email address" };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    // Only people already invited in Supabase can sign in. No self sign-up.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });

  // Same message either way, so the form doesn't reveal who has an account.
  if (error?.status === 429) {
    // Supabase caps how many sign-in emails go out per hour.
    return { status: "error", message: "Too many sign-in emails were sent recently. Wait a few minutes and try again." };
  }
  if (error && error.status !== 400 && error.status !== 422) {
    return { status: "error", message: "Couldn't send the link. Try again in a minute." };
  }
  return { status: "sent", message: `If ${email.data} is on the team, a sign-in link is on its way.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

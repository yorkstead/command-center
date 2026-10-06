"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Outcome = { status: "signed-in" } | { status: "error"; message: string } | null;

/**
 * Supabase's invite emails sign you in by putting the session in the URL after
 * "#" (…#access_token=…&refresh_token=…). The server never sees that part, so
 * pick it up here, save the session, and go to the app.
 */
async function consumeLinkSession(): Promise<Outcome> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  if (hash.get("error_description")) {
    history.replaceState(null, "", window.location.pathname);
    return { status: "error", message: "That sign-in link expired or was already used. Send a new one below." };
  }
  if (!accessToken || !refreshToken) return null;

  const { error } = await createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  history.replaceState(null, "", window.location.pathname);
  return error ? { status: "error", message: "That sign-in link didn't work. Send a new one below." } : { status: "signed-in" };
}

export function LinkSession() {
  const [outcome, setOutcome] = useState<Outcome>(null);

  useEffect(() => {
    consumeLinkSession().then((result) => {
      if (result?.status === "signed-in") window.location.replace("/");
      else setOutcome(result);
    });
  }, []);

  if (outcome?.status === "error") return <p className="mt-4 text-sm text-destructive">{outcome.message}</p>;
  return null;
}

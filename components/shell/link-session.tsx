"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Supabase invite links land with the session in the URL fragment (#access_token=...),
// which the server never sees. This runs on every page, so the link works even when
// the browser already has someone signed in.
async function consumeLinkSession(): Promise<string | null> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get("error_description")) return "/login?error=link";

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const { error } = await createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return error ? "/login?error=link" : "/";
}

export function LinkSession() {
  useEffect(() => {
    consumeLinkSession().then((destination) => {
      if (destination) window.location.replace(destination);
    });
  }, []);

  return null;
}

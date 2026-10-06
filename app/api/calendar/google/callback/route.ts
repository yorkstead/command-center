import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, safeEqual } from "@/lib/calendar/crypto";
import { calendarId, exchangeCode, syncAndRenew } from "@/lib/calendar/google";

export const maxDuration = 60;

// Google sends you back here after you allow read access to the calendar.
export async function GET(request: Request) {
  const { me } = await requireMember();
  const url = new URL(request.url);
  const done = (result: string) => {
    const response = NextResponse.redirect(new URL(`/meetings?calendar=${result}`, url));
    response.cookies.delete("g_oauth_state");
    return response;
  };

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const expected = (await cookies()).get("g_oauth_state")?.value ?? "";
  if (!code || !expected || !safeEqual(state, expected)) return done("failed");

  let connection: { id: string; channel_expires_at: string | null };
  try {
    const { refreshToken, email } = await exchangeCode(code);
    const { data, error } = await createAdminClient()
      .from("calendar_connections")
      .upsert(
        {
          profile_id: me.id,
          account_email: email,
          calendar_id: calendarId(),
          refresh_token_enc: encrypt(refreshToken),
          sync_token: null,
          last_error: null,
        },
        { onConflict: "provider,calendar_id" },
      )
      .select("id, channel_expires_at")
      .single();
    if (error) throw error;
    connection = data;
  } catch (err) {
    console.error("calendar connect failed", err);
    return done("failed");
  }

  // First pull and the push subscription happen after the redirect; the page shows progress.
  after(() => syncAndRenew({ id: connection.id, channel_expires_at: null }));
  return done("connected");
}

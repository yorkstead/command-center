import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { googleAuthUrl } from "@/lib/calendar/google";

// The "Connect Google Calendar" link on the Meetings page. Sends you to Google's consent screen.
export async function GET() {
  await requireMember();
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set("g_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}

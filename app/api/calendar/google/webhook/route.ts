import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/calendar/crypto";
import { recordSyncError, syncConnection } from "@/lib/calendar/google";

export const maxDuration = 60;

// Google's "something changed on the calendar" ping. It carries no event data;
// we answer at once and then ask Google for the changes.
export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token") ?? "";
  const state = request.headers.get("x-goog-resource-state"); // 'sync' | 'exists' | 'not_exists'
  if (!channelId || !/^[0-9a-f-]{36}$/i.test(channelId)) return new Response(null, { status: 400 });

  const { data: conn } = await createAdminClient()
    .from("calendar_connections")
    .select("id, channel_token")
    .eq("channel_id", channelId)
    .maybeSingle();

  // An old channel we've replaced: say OK so Google stops retrying.
  if (!conn) return new Response(null, { status: 200 });
  if (!conn.channel_token || !safeEqual(token, conn.channel_token)) return new Response(null, { status: 401 });
  // The handshake Google sends when a channel opens.
  if (state === "sync") return new Response(null, { status: 200 });

  after(() => syncConnection(conn.id).catch((err) => recordSyncError(conn.id, err)));
  return new Response(null, { status: 200 });
}

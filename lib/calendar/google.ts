import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "./crypto";
import { horizon, toExternalEvent, type GoogleEvent } from "./events";
import { upsertMeetingFromEvent } from "./upsert-meeting";

// Plain fetch against four Google endpoints; the googleapis package is large
// and we'd use a sliver of it.
const API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "openid email https://www.googleapis.com/auth/calendar.readonly";
const FULL_SYNC_EVERY_MS = 7 * 86_400_000;

export function appUrl() {
  return (process.env.APP_URL ?? "https://cal.yorkstead.com").replace(/\/$/, "");
}

const redirectUri = () => `${appUrl()}/api/calendar/google/callback`;

function env(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_CALENDAR_ID") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const calendarId = () => env("GOOGLE_CALENDAR_ID");

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // we need a refresh token
    prompt: "consent", // Google only hands out a refresh token on the consent screen
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...body }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; id_token?: string };
}

export async function exchangeCode(code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token");
  // The id_token came straight from Google's token endpoint over TLS, so reading it unverified is fine.
  const claims = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString() || "{}");
  return { refreshToken: t.refresh_token, email: String(claims.email ?? "unknown") };
}

async function accessToken(refreshTokenEnc: string) {
  const t = await tokenRequest({ refresh_token: decrypt(refreshTokenEnc), grant_type: "refresh_token" });
  return t.access_token;
}

type Connection = {
  id: string;
  profile_id: string;
  calendar_id: string;
  refresh_token_enc: string;
  sync_token: string | null;
  full_synced_at: string | null;
  channel_id: string | null;
  channel_resource_id: string | null;
  channel_expires_at: string | null;
};

async function loadConnection(connectionId: string) {
  const { data, error } = await createAdminClient()
    .from("calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  return data as Connection | null;
}

export async function listConnections() {
  const { data, error } = await createAdminClient().from("calendar_connections").select("id, channel_expires_at");
  if (error) throw error;
  return (data ?? []) as { id: string; channel_expires_at: string | null }[];
}

/**
 * Pull everything that changed since the last sync into meetings.
 * Once a week (or when Google expires the bookmark) it pulls the whole window
 * again, which picks up far-off repeats of a recurring meeting as they come into range.
 */
export async function syncConnection(connectionId: string, { forceFull = false } = {}): Promise<void> {
  const db = createAdminClient();
  const conn = await loadConnection(connectionId);
  if (!conn) return;

  const fullDue = !conn.full_synced_at || Date.now() - new Date(conn.full_synced_at).getTime() > FULL_SYNC_EVERY_MS;
  const full = forceFull || fullDue || !conn.sync_token;
  const token = await accessToken(conn.refresh_token_enc);

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const p = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
    if (full) {
      p.set("timeMin", new Date(Date.now() - 30 * 86_400_000).toISOString());
      p.set("timeMax", horizon().toISOString()); // don't download endless repeats we'd skip anyway
      p.set("showDeleted", "true"); // so a deletion we missed still marks the meeting cancelled
    } else p.set("syncToken", conn.sync_token!);
    if (pageToken) p.set("pageToken", pageToken);

    const res = await fetch(`${API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Google expired our bookmark: start over with a full pull.
    if (res.status === 410 && !full) return syncConnection(connectionId, { forceFull: true });
    if (!res.ok) throw new Error(`Google Calendar read failed (${res.status}): ${await res.text()}`);

    const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
    for (const item of body.items ?? []) {
      await upsertMeetingFromEvent(db, toExternalEvent(item), conn.profile_id);
    }
    pageToken = body.nextPageToken;
    nextSyncToken = body.nextSyncToken;
  } while (pageToken);

  const now = new Date().toISOString();
  const { error } = await db
    .from("calendar_connections")
    .update({
      sync_token: nextSyncToken ?? conn.sync_token,
      last_synced_at: now,
      last_error: null,
      ...(full ? { full_synced_at: now } : {}),
    })
    .eq("id", conn.id);
  if (error) throw error;
}

/** Ask Google to ping us when the calendar changes. Replaces any existing channel. */
export async function startWatch(connectionId: string) {
  // Google only pushes to public HTTPS addresses, so there's nothing to watch from localhost.
  if (!appUrl().startsWith("https://")) return;

  const db = createAdminClient();
  const conn = await loadConnection(connectionId);
  if (!conn) return;
  const token = await accessToken(conn.refresh_token_enc);
  const channelId = randomUUID();
  const channelToken = randomBytes(24).toString("hex");

  const res = await fetch(`${API}/calendars/${encodeURIComponent(conn.calendar_id)}/events/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: `${appUrl()}/api/calendar/google/webhook`,
      token: channelToken,
    }),
  });
  if (!res.ok) throw new Error(`Google Calendar watch failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { resourceId: string; expiration: string };

  const { error } = await db
    .from("calendar_connections")
    .update({
      channel_id: channelId,
      channel_resource_id: body.resourceId,
      channel_token: channelToken,
      channel_expires_at: new Date(Number(body.expiration)).toISOString(),
    })
    .eq("id", conn.id);
  if (error) throw error;

  // Stop the old channel so Google doesn't ping us twice. Best effort: it expires on its own.
  if (conn.channel_id && conn.channel_resource_id) {
    await fetch(`${API}/channels/stop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id: conn.channel_id, resourceId: conn.channel_resource_id }),
    }).catch(() => undefined);
  }
}

export async function recordSyncError(connectionId: string, err: unknown) {
  console.error("calendar sync failed", connectionId, err);
  const message = err instanceof Error ? err.message : String(err);
  await createAdminClient()
    .from("calendar_connections")
    .update({ last_error: message.slice(0, 500) })
    .eq("id", connectionId);
}

/** Sync, then renew the push channel if it's missing or ends within two days. */
export async function syncAndRenew(conn: { id: string; channel_expires_at: string | null }, opts?: { forceFull?: boolean }) {
  try {
    await syncConnection(conn.id, opts);
    const renewBy = Date.now() + 2 * 86_400_000;
    if (!conn.channel_expires_at || new Date(conn.channel_expires_at).getTime() < renewBy) await startWatch(conn.id);
  } catch (err) {
    await recordSyncError(conn.id, err);
    return false;
  }
  return true;
}

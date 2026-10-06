import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPeople, type ExternalEvent } from "./events";

const UNIQUE_VIOLATION = "23505";

/**
 * One calendar event in, one meetings row out.
 * The calendar owns title, time and location. The app owns notes, agenda,
 * follow-ups, and any client or owner someone set by hand.
 */
export async function upsertMeetingFromEvent(
  db: SupabaseClient,
  ev: ExternalEvent,
  fallbackOwnerId: string | null,
  retried = false,
): Promise<void> {
  if (ev.cancelled) {
    const { error } = await db
      .from("meetings")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("external_cal_id", ev.externalId)
      .is("cancelled_at", null);
    if (error) throw error;
    return;
  }

  // Two people and a short contact list: match emails in code, case-insensitively.
  const [profilesRes, contactsRes] = await Promise.all([
    db.from("profiles").select("id, email").eq("is_active", true),
    db.from("contacts").select("id, email, client_id").not("email", "is", null),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (contactsRes.error) throw contactsRes.error;
  const match = matchPeople(ev, profilesRes.data ?? [], contactsRes.data ?? [], fallbackOwnerId);

  const calendarFields = {
    title: ev.title,
    starts_at: ev.startsAt,
    ends_at: ev.endsAt,
    location: ev.location,
    source: "google",
    cancelled_at: null,
  };

  const { data: existing, error: findError } = await db
    .from("meetings")
    .select("id, client_id, owner_id")
    .eq("external_cal_id", ev.externalId)
    .maybeSingle();
  if (findError) throw findError;

  let meetingId: string;
  if (existing) {
    meetingId = existing.id;
    const { error } = await db
      .from("meetings")
      .update({
        ...calendarFields,
        client_id: existing.client_id ?? match.clientId, // never overwrite a link set by hand
        owner_id: existing.owner_id ?? match.ownerId,
      })
      .eq("id", meetingId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from("meetings")
      .insert({ ...calendarFields, external_cal_id: ev.externalId, client_id: match.clientId, owner_id: match.ownerId })
      .select("id")
      .single();
    // Two pings raced and the other inserted first: go round again as an update.
    if (error?.code === UNIQUE_VIOLATION && !retried) return upsertMeetingFromEvent(db, ev, fallbackOwnerId, true);
    if (error) throw error;
    meetingId = data.id;
  }

  // Add anyone new to the attendee list; leave existing (and hand-added) attendees alone.
  const rows: { meeting_id: string; profile_id?: string; contact_id?: string }[] = [
    ...match.team.map((p) => ({ meeting_id: meetingId, profile_id: p.id as string })),
    ...match.contacts.map((c) => ({ meeting_id: meetingId, contact_id: c.id as string })),
  ];
  for (const row of rows) {
    const { error } = await db.from("meeting_attendees").insert(row);
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  }
}

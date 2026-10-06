// Turning a Google Calendar event into the fields we keep on a meeting.
// No server-only imports here, so the rules are unit-tested directly.

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: { email?: string; resource?: boolean; responseStatus?: string }[];
};

export type ExternalEvent =
  | { externalId: string; cancelled: true }
  | {
      externalId: string;
      cancelled: false;
      title: string;
      startsAt: string;
      endsAt: string | null;
      location: string | null;
      organizerEmail: string | null;
      attendeeEmails: string[];
    };

/** How far ahead we store events. Repeating meetings with no end date stop here. */
export const HORIZON_DAYS = 365;

export function googleExternalId(eventId: string) {
  return `google:${eventId}`;
}

/** null means "not a meeting, skip it". */
export function toExternalEvent(e: GoogleEvent, now = new Date()): ExternalEvent | null {
  const externalId = googleExternalId(e.id);
  if (e.status === "cancelled") return { externalId, cancelled: true };
  // All-day events are holds and days off, not meetings.
  if (!e.start?.dateTime) return null;

  const start = new Date(e.start.dateTime);
  if (Number.isNaN(start.getTime())) return null;
  if (start.getTime() > now.getTime() + HORIZON_DAYS * 86_400_000) return null;

  const end = e.end?.dateTime ? new Date(e.end.dateTime) : null;
  return {
    externalId,
    cancelled: false,
    title: e.summary?.trim() || "(no title)",
    startsAt: start.toISOString(),
    // The database requires end after start; a zero-length event just has no end.
    endsAt: end && end.getTime() > start.getTime() ? end.toISOString() : null,
    location: e.location?.trim() || e.hangoutLink || null,
    organizerEmail: e.organizer?.email ? normalizeEmail(e.organizer.email) : null,
    attendeeEmails: (e.attendees ?? [])
      .filter((a) => a.email && !a.resource && a.responseStatus !== "declined")
      .map((a) => normalizeEmail(a.email!)),
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type Person = { id: string; email: string | null };

/**
 * Who's in the meeting, by email. The owner is the organizer if they're on the
 * team, else the first teammate invited, else whoever connected the calendar.
 * The client is the client of the first known contact invited.
 */
export function matchPeople<P extends Person, C extends Person & { client_id: string }>(
  ev: Extract<ExternalEvent, { cancelled: false }>,
  profiles: P[],
  contacts: C[],
  fallbackOwnerId: string | null,
) {
  const emails = new Set([ev.organizerEmail, ...ev.attendeeEmails].filter((e): e is string => !!e));
  const has = (p: Person) => !!p.email && emails.has(normalizeEmail(p.email));
  const team = profiles.filter(has);
  const people = contacts.filter(has);
  const organizer = team.find((p) => ev.organizerEmail && normalizeEmail(p.email!) === ev.organizerEmail);
  return {
    team,
    contacts: people,
    ownerId: organizer?.id ?? team[0]?.id ?? fallbackOwnerId,
    clientId: people[0]?.client_id ?? null,
  };
}

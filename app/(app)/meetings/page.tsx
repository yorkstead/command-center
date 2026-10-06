import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { addDays, dayBoundsUtc, isoDateInZone, timeLabel } from "@/lib/dates";
import type { Client, Meeting } from "@/lib/db/types";
import { PageHeader, Section, EmptyState } from "@/components/ui/page-header";
import { OwnerAvatar } from "@/components/ui/badge";
import { QuickAddMeeting } from "@/components/meetings/quick-add-meeting";

export const metadata: Metadata = { title: "Meetings" };

const DAYS_AHEAD = 14;

export default async function MeetingsPage() {
  const { supabase, me, team } = await requireMember();
  const today = isoDateInZone();
  const from = dayBoundsUtc(today).start;
  const to = dayBoundsUtc(addDays(today, DAYS_AHEAD)).start;

  const [meetingsRes, clientsRes] = await Promise.all([
    supabase.from("meetings").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    supabase.from("clients").select("id, name").is("archived_at", null).order("name"),
  ]);
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "name">[];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const initials = new Map(team.map((m) => [m.id, m.initials]));

  const byDay = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const day = isoDateInZone(new Date(m.starts_at));
    byDay.set(day, [...(byDay.get(day) ?? []), m]);
  }

  return (
    <>
      <PageHeader title="Meetings" subtitle={`Next ${DAYS_AHEAD} days`} />
      <QuickAddMeeting team={team} clients={clients} meId={me.id} today={today} />
      <div className="space-y-4 p-4 md:p-6">
        {byDay.size === 0 ? (
          <Section title="Upcoming"><EmptyState>No meetings in the next {DAYS_AHEAD} days.</EmptyState></Section>
        ) : (
          [...byDay.entries()].map(([day, items]) => (
            <Section key={day} title={dayHeading(day, today)} count={items.length}>
              <ul className="divide-y">
                {items.map((m) => (
                  <li key={m.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-sm">
                    <span className="tabular text-xs text-muted-foreground">{timeLabel(m.starts_at)}</span>
                    <div className="min-w-0">
                      <p className="truncate">{m.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[m.client_id ? clientName.get(m.client_id) : null, m.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <OwnerAvatar initials={m.owner_id ? initials.get(m.owner_id) : null} />
                  </li>
                ))}
              </ul>
            </Section>
          ))
        )}
      </div>
    </>
  );
}

function dayHeading(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });
}


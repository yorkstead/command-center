// The team works in Denver, so "today" means today in Denver, not on the server.
export const TEAM_TIME_ZONE = "America/Denver";

/** YYYY-MM-DD for the given instant in the team's time zone. */
export function isoDateInZone(at: Date = new Date(), timeZone = TEAM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Short, human due label: "Overdue 3d", "Today", "Tomorrow", "Fri Oct 9". */
export function dueLabel(dueDate: string | null, today: string): string {
  if (!dueDate) return "No date";
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return `Overdue ${-diff}d`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Date(`${dueDate}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TEAM_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

/** Start and end of a team-local day as UTC ISO strings, for timestamp range queries. */
export function dayBoundsUtc(isoDate: string, timeZone = TEAM_TIME_ZONE): { start: string; end: string } {
  return { start: zonedMidnightUtc(isoDate, timeZone), end: zonedMidnightUtc(addDays(isoDate, 1), timeZone) };
}

function zonedMidnightUtc(isoDate: string, timeZone: string): string {
  // Guess midnight UTC, measure the zone's offset at that moment, then correct.
  const guess = new Date(`${isoDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offsetMs = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs).toISOString();
}

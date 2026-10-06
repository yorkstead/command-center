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
  return { start: zonedTimeToUtc(isoDate, "00:00", timeZone), end: zonedTimeToUtc(addDays(isoDate, 1), "00:00", timeZone) };
}

/**
 * A wall-clock date and time in the team's zone ("2026-03-08", "09:00") as a UTC ISO string.
 * Uses the zone's offset at that moment, so days when clocks change come out right.
 */
export function zonedTimeToUtc(isoDate: string, time: string, timeZone = TEAM_TIME_ZONE): string {
  const wallAsUtc = Date.parse(`${isoDate}T${time}:00Z`);
  // First guess uses the offset at the wall time read as UTC; the second pass
  // re-measures at the corrected instant, which settles across a clock change.
  let instant = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  instant = wallAsUtc - zoneOffsetMs(instant, timeZone);
  return new Date(instant).toISOString();
}

/** How far the zone's clock is ahead of UTC at the given instant, in ms (negative for Denver). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return wall - Math.floor(instant / 60_000) * 60_000;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

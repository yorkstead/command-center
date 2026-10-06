import { describe, expect, test } from "bun:test";
import { addDays, agoLabel, dayBoundsUtc, daysBetween, dueLabel, isoDateInZone, zonedTimeToUtc } from "@/lib/dates";

describe("isoDateInZone", () => {
  test("uses Denver's date, not UTC's, in the evening", () => {
    // 7pm Denver on Oct 6 is already Oct 7 in UTC.
    expect(isoDateInZone(new Date("2026-10-07T01:00:00Z"))).toBe("2026-10-06");
  });
});

describe("dayBoundsUtc", () => {
  test("midnight Denver in daylight time is 06:00 UTC", () => {
    expect(dayBoundsUtc("2026-10-06")).toEqual({ start: "2026-10-06T06:00:00.000Z", end: "2026-10-07T06:00:00.000Z" });
  });
  test("midnight Denver in standard time is 07:00 UTC", () => {
    expect(dayBoundsUtc("2026-12-01").start).toBe("2026-12-01T07:00:00.000Z");
  });
});

describe("zonedTimeToUtc", () => {
  test("ordinary days", () => {
    expect(zonedTimeToUtc("2026-10-06", "09:00")).toBe("2026-10-06T15:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "09:00")).toBe("2026-12-01T16:00:00.000Z");
  });
  test("the day clocks spring forward (Mar 8, 2026)", () => {
    expect(zonedTimeToUtc("2026-03-08", "00:00")).toBe("2026-03-08T07:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-08", "09:00")).toBe("2026-03-08T15:00:00.000Z");
  });
  test("the day clocks fall back (Nov 1, 2026)", () => {
    expect(zonedTimeToUtc("2026-11-01", "00:00")).toBe("2026-11-01T06:00:00.000Z");
    expect(zonedTimeToUtc("2026-11-01", "09:00")).toBe("2026-11-01T16:00:00.000Z");
  });
});

describe("due labels", () => {
  test("overdue, today, tomorrow, later", () => {
    expect(dueLabel("2026-10-03", "2026-10-06")).toBe("Overdue 3d");
    expect(dueLabel("2026-10-06", "2026-10-06")).toBe("Today");
    expect(dueLabel("2026-10-07", "2026-10-06")).toBe("Tomorrow");
    expect(dueLabel("2026-10-09", "2026-10-06")).toBe("Fri, Oct 9");
    expect(dueLabel(null, "2026-10-06")).toBe("No date");
  });
  test("date math crosses month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("agoLabel", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  test("buckets", () => {
    expect(agoLabel("2026-10-06T11:59:30Z", now)).toBe("just now");
    expect(agoLabel("2026-10-06T11:55:00Z", now)).toBe("5 min ago");
    expect(agoLabel("2026-10-06T09:00:00Z", now)).toBe("3 h ago");
    expect(agoLabel("2026-10-05T11:00:00Z", now)).toBe("1 day ago");
  });
});

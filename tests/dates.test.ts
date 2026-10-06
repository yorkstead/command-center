import { describe, expect, test } from "bun:test";
import { addDays, dayBoundsUtc, daysBetween, dueLabel, isoDateInZone } from "@/lib/dates";

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

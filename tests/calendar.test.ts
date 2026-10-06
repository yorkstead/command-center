import { describe, expect, test } from "bun:test";
import { createHmac, randomBytes } from "node:crypto";
import { matchPeople, toExternalEvent, type ExternalEvent } from "@/lib/calendar/events";
import { decrypt, encrypt, safeEqual } from "@/lib/calendar/crypto";
import { bookerFrom, ilikeLiteral, validCalSignature } from "@/lib/calendar/calcom";

const now = new Date("2026-10-06T12:00:00Z");
type Live = Extract<ExternalEvent, { cancelled: false }>;

describe("toExternalEvent", () => {
  test("maps a timed event", () => {
    const ev = toExternalEvent(
      {
        id: "abc",
        status: "confirmed",
        summary: " Demo with Union ",
        start: { dateTime: "2026-10-07T09:00:00-06:00" },
        end: { dateTime: "2026-10-07T10:00:00-06:00" },
        hangoutLink: "https://meet.google.com/x",
        organizer: { email: "Brandon@Yorkstead.com" },
        attendees: [
          { email: "owner@union.com", responseStatus: "accepted" },
          { email: "no@union.com", responseStatus: "declined" },
          { email: "room@resource.calendar.google.com", resource: true },
        ],
      },
      now,
    );
    expect(ev).toEqual({
      externalId: "google:abc",
      cancelled: false,
      title: "Demo with Union",
      startsAt: "2026-10-07T15:00:00.000Z",
      endsAt: "2026-10-07T16:00:00.000Z",
      location: "https://meet.google.com/x",
      organizerEmail: "brandon@yorkstead.com",
      attendeeEmails: ["owner@union.com"],
    });
  });

  test("a cancelled event only carries its id", () => {
    expect(toExternalEvent({ id: "abc", status: "cancelled" }, now)).toEqual({ externalId: "google:abc", cancelled: true });
  });

  test("all-day events and events past the horizon retire any meeting we imported", () => {
    expect(toExternalEvent({ id: "a", start: { date: "2026-10-07" } }, now)).toEqual({ externalId: "google:a", cancelled: true });
    expect(toExternalEvent({ id: "b", start: { dateTime: "2028-01-01T09:00:00Z" } }, now)).toEqual({
      externalId: "google:b",
      cancelled: true,
    });
  });

  test("drops an end that isn't after the start, since the database rejects it", () => {
    const ev = toExternalEvent(
      { id: "a", start: { dateTime: "2026-10-07T09:00:00Z" }, end: { dateTime: "2026-10-07T09:00:00Z" } },
      now,
    ) as Live;
    expect(ev.endsAt).toBeNull();
    expect(ev.title).toBe("(no title)");
  });
});

describe("matchPeople", () => {
  const profiles = [
    { id: "brandon", email: "brandon@yorkstead.com" },
    { id: "eric", email: "Eric@Yorkstead.com" },
  ];
  const contacts = [{ id: "c1", email: "Owner@Union.com", client_id: "union" }];
  const base = toExternalEvent(
    { id: "x", start: { dateTime: "2026-10-07T09:00:00Z" }, organizer: { email: "eric@yorkstead.com" } },
    now,
  ) as Live;

  test("organizer on the team owns it; invited contact sets the client", () => {
    const m = matchPeople({ ...base, attendeeEmails: ["brandon@yorkstead.com", "owner@union.com"] }, profiles, contacts, null);
    expect(m.ownerId).toBe("eric");
    expect(m.clientId).toBe("union");
    expect(m.team.map((p) => p.id)).toEqual(["brandon", "eric"]);
    expect(m.contacts.map((c) => c.id)).toEqual(["c1"]);
  });

  test("falls back to whoever connected the calendar", () => {
    const m = matchPeople({ ...base, organizerEmail: "someone@else.com", attendeeEmails: [] }, profiles, contacts, "brandon");
    expect(m.ownerId).toBe("brandon");
    expect(m.clientId).toBeNull();
  });
});

describe("token encryption", () => {
  test("round-trips and detects tampering", () => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const packed = encrypt("1//refresh-token");
    expect(packed).not.toContain("refresh");
    expect(decrypt(packed)).toBe("1//refresh-token");
    const [iv, tag, data] = packed.split(".");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  test("refuses a key of the wrong length", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "short";
    expect(() => encrypt("x")).toThrow();
  });

  test("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("Cal.com", () => {
  test("checks the signature over the raw body", () => {
    const raw = '{"triggerEvent":"BOOKING_CREATED"}';
    const sig = createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(validCalSignature(raw, sig, "s3cret")).toBe(true);
    expect(validCalSignature(raw + " ", sig, "s3cret")).toBe(false);
    expect(validCalSignature(raw, sig, "other")).toBe(false);
  });

  test("reads the booker and company", () => {
    expect(
      bookerFrom({
        triggerEvent: "BOOKING_CREATED",
        payload: { attendees: [{ email: " Pat@Shop.com ", name: "Pat" }], responses: { company: { value: "Pat's Shop" } } },
      }),
    ).toEqual({ email: "pat@shop.com", name: "Pat", companyName: "Pat's Shop" });
    expect(bookerFrom({ triggerEvent: "BOOKING_CANCELLED", payload: {} })).toBeNull();
    expect(bookerFrom({ triggerEvent: "BOOKING_CREATED", payload: { attendees: [{ name: "Pat" }] } })).toBeNull();
  });

  test("escapes wildcards for ilike", () => {
    expect(ilikeLiteral("100%_co")).toBe("100\\%\\_co");
  });
});

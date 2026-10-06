import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";

export type CalBooking = {
  triggerEvent?: string;
  payload?: {
    attendees?: { email?: string; name?: string }[];
    responses?: { company?: { value?: string } | string };
  };
};

/** Cal.com signs the raw body with HMAC-SHA256 and sends the hex digest in x-cal-signature-256. */
export function validCalSignature(raw: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return safeEqual(signature, expected);
}

/** The person who booked and the company they typed, or null if there's nothing to add. */
export function bookerFrom(booking: CalBooking) {
  if (booking.triggerEvent !== "BOOKING_CREATED") return null;
  const booker = booking.payload?.attendees?.[0];
  const email = booker?.email?.trim().toLowerCase();
  if (!email) return null;
  const name = booker?.name?.trim() || email;
  const company = booking.payload?.responses?.company;
  const companyName = (typeof company === "string" ? company : company?.value)?.trim() || name;
  return { email, name, companyName };
}

/** Escape % and _ so a name is matched literally by ilike. */
export function ilikeLiteral(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

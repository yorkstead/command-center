"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { zonedTimeToUtc } from "@/lib/dates";
import { firstError, formToObject, newMeetingSchema, type ActionResult } from "@/lib/validation";

export async function createMeeting(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, me } = await requireMember();
  const parsed = newMeetingSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { title, date, time, duration_minutes, client_id, owner_id, location } = parsed.data;

  // The form's date and time are Denver time.
  const startsAt = new Date(zonedTimeToUtc(date, time));
  const endsAt = duration_minutes > 0 ? new Date(startsAt.getTime() + duration_minutes * 60_000) : null;

  const { error } = await supabase.from("meetings").insert({
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
    client_id,
    owner_id: owner_id ?? me.id,
    location,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

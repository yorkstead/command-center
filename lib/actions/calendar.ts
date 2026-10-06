"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { listConnections, syncAndRenew } from "@/lib/calendar/google";

/** The "Sync now" button on the Meetings page. */
export async function syncCalendarNow() {
  await requireMember();
  for (const c of await listConnections()) await syncAndRenew(c);
  revalidatePath("/", "layout");
}

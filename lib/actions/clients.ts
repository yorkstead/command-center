"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { firstError, formToObject, newClientSchema, type ActionResult } from "@/lib/validation";

export async function createClientRecord(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, me } = await requireMember();
  const parsed = newClientSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { error } = await supabase.from("clients").insert({ ...parsed.data, owner_id: parsed.data.owner_id ?? me.id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "A client with that name already exists" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

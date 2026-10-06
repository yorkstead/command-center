"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { firstError, formToObject, moveDealSchema, newDealSchema, type ActionResult } from "@/lib/validation";

export async function createDeal(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, me } = await requireMember();
  const parsed = newDealSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { title, stage, value, owner_id, next_step, new_client_name } = parsed.data;

  let valueCents: number | null;
  try {
    valueCents = value ? parseDollarsToCents(value) : null;
  } catch {
    return { ok: false, error: "Deal value should be a dollar amount" };
  }

  // A new lead usually means a new company: create it as a prospect in the same step.
  let clientId = parsed.data.client_id ?? null;
  if (!clientId && new_client_name) {
    const { data, error } = await supabase
      .from("clients")
      .insert({ name: new_client_name, status: "prospect", owner_id: owner_id ?? me.id })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That client already exists. Pick it from the list." };
      return { ok: false, error: error.message };
    }
    clientId = data.id;
  }
  if (!clientId) return { ok: false, error: "Pick a client or type a new one" };

  const { error } = await supabase.from("deals").insert({
    title,
    client_id: clientId,
    stage,
    value_cents: valueCents,
    owner_id: owner_id ?? me.id,
    next_step,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveDealStage(input: { id: string; stage: string; lost_reason?: string | null }): Promise<ActionResult> {
  const { supabase } = await requireMember();
  const parsed = moveDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, stage, lost_reason } = parsed.data;

  const { data: deal, error } = await supabase
    .from("deals")
    .update({ stage, lost_reason: stage === "lost" ? lost_reason : null })
    .eq("id", id)
    .select("client_id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Winning a deal makes the prospect an active client.
  if (stage === "won") {
    await supabase.from("clients").update({ status: "active" }).eq("id", deal.client_id).eq("status", "prospect");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

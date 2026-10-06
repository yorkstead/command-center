"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { firstError, formToObject, newTaskSchema, taskPatchSchema, type ActionResult } from "@/lib/validation";

export async function createTask(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, me } = await requireMember();
  const parsed = newTaskSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { error } = await supabase.from("tasks").insert({ ...parsed.data, owner_id: parsed.data.owner_id ?? me.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTask(id: string, patch: Record<string, string | null>): Promise<ActionResult> {
  const { supabase } = await requireMember();
  const taskId = z.uuid().safeParse(id);
  const parsed = taskPatchSchema.safeParse(patch);
  if (!taskId.success) return { ok: false, error: "Unknown task" };
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", taskId.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await requireMember();
  const taskId = z.uuid().safeParse(id);
  if (!taskId.success) return { ok: false, error: "Unknown task" };

  const { error } = await supabase.from("tasks").delete().eq("id", taskId.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

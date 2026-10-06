import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable())
  .nullable()
  .optional();

const optionalDate = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date().nullable())
  .nullable()
  .optional();

export const taskStatus = z.enum(["open", "in_progress", "closed"]);
export const taskPriority = z.enum(["high", "medium", "low"]);
export const dealStage = z.enum(["lead", "contacted", "demo", "proposal", "negotiation", "won", "lost"]);
export const clientStatus = z.enum(["prospect", "active", "paused", "past"]);

export const newTaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a name"),
  owner_id: optionalId,
  priority: taskPriority.default("medium"),
  due_date: optionalDate,
  next_action: optionalText,
  client_id: optionalId,
});

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1),
    owner_id: optionalId,
    priority: taskPriority,
    status: taskStatus,
    due_date: optionalDate,
    next_action: optionalText,
    client_id: optionalId,
  })
  .partial();

export const newClientSchema = z.object({
  name: z.string().trim().min(1, "Client needs a name"),
  status: clientStatus.default("prospect"),
  industry: optionalText,
  city: optionalText,
  active_scope: optionalText,
  owner_id: optionalId,
});

export const newDealSchema = z.object({
  title: z.string().trim().min(1, "Give the deal a name"),
  client_id: optionalId,
  new_client_name: optionalText,
  stage: dealStage.default("lead"),
  value: optionalText,
  owner_id: optionalId,
  next_step: optionalText,
});

export const moveDealSchema = z
  .object({
    id: z.uuid(),
    stage: dealStage,
    lost_reason: optionalText,
  })
  .refine((v) => v.stage !== "lost" || !!v.lost_reason, {
    message: "Say why the deal was lost",
    path: ["lost_reason"],
  });

export const newMeetingSchema = z.object({
  title: z.string().trim().min(1, "Give the meeting a name"),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  duration_minutes: z.coerce.number().int().min(0).max(24 * 60).default(30),
  client_id: optionalId,
  owner_id: optionalId,
  location: optionalText,
});

/** FormData to a plain object, dropping File entries. */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again";
}

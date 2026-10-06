import type { ClientStatus, DealStage, TaskPriority, TaskStatus } from "@/lib/db/types";

export const priorityTone = { high: "danger", medium: "warning", low: "neutral" } as const satisfies Record<TaskPriority, string>;
export const statusTone = { open: "neutral", in_progress: "info", closed: "success" } as const satisfies Record<TaskStatus, string>;
export const clientTone = { prospect: "info", active: "success", paused: "warning", past: "neutral" } as const satisfies Record<ClientStatus, string>;
export const stageTone = {
  lead: "neutral",
  contacted: "neutral",
  demo: "info",
  proposal: "info",
  negotiation: "warning",
  won: "success",
  lost: "danger",
} as const satisfies Record<DealStage, string>;

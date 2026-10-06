"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTask, updateTask } from "@/lib/actions/tasks";
import { dueLabel } from "@/lib/dates";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { Profile, Task } from "@/lib/db/types";

const inlineSelect =
  "h-7 rounded-sm border border-transparent bg-transparent px-1 text-xs hover:border-border focus-visible:border-ring";

export function TaskRow({
  task,
  team,
  clientName,
  today,
}: {
  task: Task;
  team: Profile[];
  clientName?: string | null;
  today: string;
}) {
  // Shown immediately; rolled back if the server says no.
  const [local, setLocal] = useState(task);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Pick up changes made elsewhere (the other person, realtime refresh).
  const [seen, setSeen] = useState(task.updated_at);
  if (task.updated_at !== seen) {
    setSeen(task.updated_at);
    setLocal(task);
  }

  function save(patch: Partial<Record<keyof Task, string | null>>) {
    const previous = local;
    setLocal({ ...local, ...patch } as Task);
    setError(null);
    startTransition(async () => {
      const result = await updateTask(task.id, patch);
      if (!result.ok) {
        setLocal(previous);
        setError(result.error);
      }
    });
  }

  function remove() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) setError(result.error);
    });
  }

  const overdue = local.status !== "closed" && local.due_date != null && local.due_date < today;
  const closed = local.status === "closed";

  return (
    <li className={cn("group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm md:grid-cols-[1fr_7rem_6rem_6.5rem_8rem_auto]", pending && "opacity-70")}>
      <div className="min-w-0">
        <p className={cn("truncate", closed && "text-muted-foreground line-through")}>{local.title}</p>
        {(clientName || local.next_action) && (
          <p className="truncate text-xs text-muted-foreground">
            {clientName}
            {clientName && local.next_action ? " · " : ""}
            {local.next_action ? `Next: ${local.next_action}` : ""}
          </p>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <select aria-label="Status" value={local.status} onChange={(e) => save({ status: e.target.value })} className={inlineSelect}>
        {TASK_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        aria-label="Priority"
        value={local.priority}
        onChange={(e) => save({ priority: e.target.value })}
        className={cn(inlineSelect, "hidden md:block", local.priority === "high" && "text-destructive")}
      >
        {TASK_PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <select
        aria-label="Owner"
        value={local.owner_id ?? ""}
        onChange={(e) => save({ owner_id: e.target.value || null })}
        className={cn(inlineSelect, "hidden md:block")}
      >
        <option value="">Unassigned</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      <label className={cn("hidden items-center gap-1 text-xs md:flex", overdue ? "text-destructive" : "text-muted-foreground")}>
        <span className="sr-only">Due date</span>
        <input
          type="date"
          value={local.due_date ?? ""}
          onChange={(e) => save({ due_date: e.target.value || null })}
          className={cn(inlineSelect, "w-full")}
          title={dueLabel(local.due_date, today)}
        />
      </label>

      <button
        type="button"
        onClick={remove}
        aria-label="Delete task"
        className="hidden size-7 items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 md:inline-flex"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      <p className={cn("col-span-2 text-xs md:hidden", overdue ? "text-destructive" : "text-muted-foreground")}>
        {dueLabel(local.due_date, today)} · {team.find((m) => m.id === local.owner_id)?.display_name ?? "Unassigned"}
      </p>
    </li>
  );
}

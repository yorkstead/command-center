"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import { TASK_PRIORITIES } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-status";
import type { Client, Profile } from "@/lib/db/types";

export function QuickAddTask({ team, clients, meId }: { team: Profile[]; clients: Pick<Client, "id" | "name">[]; meId: string }) {
  const [state, action, pending] = useActionState(createTask, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
      <Input name="title" placeholder="Add a task…" required className="min-w-48 flex-1" />
      <Select name="owner_id" defaultValue={meId} aria-label="Owner">
        {team.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </Select>
      <Select name="priority" defaultValue="medium" aria-label="Priority">
        {TASK_PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </Select>
      <Select name="client_id" defaultValue="" aria-label="Client">
        <option value="">No client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Input name="due_date" type="date" aria-label="Due date" />
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus className="size-4" aria-hidden /> Add
      </Button>
      <div className="w-full empty:hidden">
        <FormError state={state} />
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createMeeting } from "@/lib/actions/meetings";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-status";
import type { Client, Profile } from "@/lib/db/types";

export function QuickAddMeeting({
  team,
  clients,
  meId,
  today,
}: {
  team: Profile[];
  clients: Pick<Client, "id" | "name">[];
  meId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(createMeeting, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
      <Input name="title" placeholder="New meeting…" required className="min-w-48 flex-1" />
      <Input name="date" type="date" defaultValue={today} required aria-label="Date" />
      <Input name="time" type="time" defaultValue="09:00" required aria-label="Start time" />
      <Select name="duration_minutes" defaultValue="30" aria-label="Length">
        <option value="15">15 min</option>
        <option value="30">30 min</option>
        <option value="60">1 hr</option>
        <option value="90">1.5 hr</option>
        <option value="0">No end</option>
      </Select>
      <Select name="client_id" defaultValue="" aria-label="Client">
        <option value="">No client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Select name="owner_id" defaultValue={meId} aria-label="Owner">
        {team.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </Select>
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus className="size-4" aria-hidden /> Add
      </Button>
      <div className="w-full empty:hidden">
        <FormError state={state} />
      </div>
    </form>
  );
}

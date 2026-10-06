"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createDeal } from "@/lib/actions/deals";
import { DEAL_STAGES } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-status";
import type { Client, Profile } from "@/lib/db/types";

export function QuickAddDeal({ team, clients, meId }: { team: Profile[]; clients: Pick<Client, "id" | "name">[]; meId: string }) {
  const [state, action, pending] = useActionState(createDeal, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
      <Input name="title" placeholder="New deal…" required className="min-w-48 flex-1" />
      <Select name="client_id" defaultValue="" aria-label="Client">
        <option value="">New client →</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Input name="new_client_name" placeholder="New client name" className="w-40" />
      <Input name="value" inputMode="decimal" placeholder="$ value" className="w-28" />
      <Select name="stage" defaultValue="lead" aria-label="Stage">
        {DEAL_STAGES.filter((s) => s.value !== "won" && s.value !== "lost").map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
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

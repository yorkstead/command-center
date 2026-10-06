"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createClientRecord } from "@/lib/actions/clients";
import { CLIENT_STATUSES } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-status";

export function QuickAddClient() {
  const [state, action, pending] = useActionState(createClientRecord, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
      <Input name="name" placeholder="Company name…" required className="min-w-48 flex-1" />
      <Select name="status" defaultValue="prospect" aria-label="Status">
        {CLIENT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </Select>
      <Input name="industry" placeholder="Industry" className="w-36" />
      <Input name="city" placeholder="City" className="w-32" />
      <Input name="active_scope" placeholder="What we're doing for them" className="min-w-48 flex-1" />
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus className="size-4" aria-hidden /> Add
      </Button>
      <div className="w-full empty:hidden">
        <FormError state={state} />
      </div>
    </form>
  );
}

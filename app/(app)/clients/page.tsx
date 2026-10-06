import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { CLIENT_STATUSES, labelFor } from "@/lib/labels";
import type { Client, Deal, Task } from "@/lib/db/types";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge, OwnerAvatar } from "@/components/ui/badge";
import { clientTone } from "@/components/ui/tones";
import { QuickAddClient } from "@/components/clients/quick-add-client";

export const metadata: Metadata = { title: "Clients" };

const STATUS_ORDER = { active: 0, prospect: 1, paused: 2, past: 3 } as const;

export default async function ClientsPage() {
  const { supabase, team } = await requireMember();

  const [clientsRes, dealsRes, tasksRes] = await Promise.all([
    supabase.from("clients").select("*").is("archived_at", null).order("name"),
    supabase.from("deals").select("client_id, stage").not("stage", "in", "(won,lost)"),
    supabase.from("tasks").select("client_id").neq("status", "closed").not("client_id", "is", null),
  ]);
  const clients = ((clientsRes.data ?? []) as Client[]).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const openDeals = countBy((dealsRes.data ?? []) as Pick<Deal, "client_id">[]);
  const openTasks = countBy((tasksRes.data ?? []) as Pick<Task, "client_id">[]);
  const initials = new Map(team.map((m) => [m.id, m.initials]));

  return (
    <>
      <PageHeader title="Clients" subtitle={`${clients.length} on the roster`} />
      <QuickAddClient />
      {clients.length === 0 ? (
        <EmptyState>No clients yet. Add one above, or create a deal and it will be added as a prospect.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-1.5 font-semibold md:px-6">Client</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="hidden px-2 py-1.5 font-semibold md:table-cell">Active scope</th>
                <th className="px-2 py-1.5 text-right font-semibold">Deals</th>
                <th className="px-2 py-1.5 text-right font-semibold">Tasks</th>
                <th className="px-4 py-1.5 font-semibold md:px-6"><span className="sr-only">Owner</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 md:px-6">
                    <p>{c.name}</p>
                    <p className="text-xs text-muted-foreground">{[c.industry, c.city].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-2 py-2"><Badge tone={clientTone[c.status]}>{labelFor(CLIENT_STATUSES, c.status)}</Badge></td>
                  <td className="hidden max-w-md truncate px-2 py-2 text-muted-foreground md:table-cell">{c.active_scope}</td>
                  <td className="tabular px-2 py-2 text-right">{openDeals.get(c.id) ?? 0}</td>
                  <td className="tabular px-2 py-2 text-right">{openTasks.get(c.id) ?? 0}</td>
                  <td className="px-4 py-2 md:px-6"><OwnerAvatar initials={c.owner_id ? initials.get(c.owner_id) : null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function countBy(rows: { client_id: string | null }[]) {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.client_id) counts.set(r.client_id, (counts.get(r.client_id) ?? 0) + 1);
  return counts;
}

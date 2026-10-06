import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { daysBetween, isoDateInZone } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { DEAL_STAGES } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { Client, Deal } from "@/lib/db/types";
import { PageHeader } from "@/components/ui/page-header";
import { OwnerAvatar } from "@/components/ui/badge";
import { OwnerFilter, resolveOwner } from "@/components/ui/owner-filter";
import { DealStageSelect } from "@/components/deals/deal-stage-select";
import { QuickAddDeal } from "@/components/deals/quick-add-deal";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const { supabase, me, team } = await requireMember();
  // The pipeline is shared work, so it opens on everyone's deals.
  const param = (await searchParams).owner ?? "all";
  const owner = resolveOwner(param, me.id, team);

  let dealQuery = supabase.from("deals").select("*").order("sort_order").order("created_at");
  if (owner.ownerId) dealQuery = dealQuery.eq("owner_id", owner.ownerId);

  const [dealsRes, clientsRes] = await Promise.all([
    dealQuery,
    supabase.from("clients").select("id, name").is("archived_at", null).order("name"),
  ]);
  const deals = (dealsRes.data ?? []) as Deal[];
  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "name">[];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const initials = new Map(team.map((m) => [m.id, m.initials]));
  const today = isoDateInZone();

  return (
    <>
      <PageHeader title="Pipeline" subtitle={`${formatCents(deals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + (d.value_cents ?? 0), 0))} open`}>
        <OwnerFilter basePath="/pipeline" current={param === "me" ? "me" : owner.key} team={team} meId={me.id} />
      </PageHeader>
      <QuickAddDeal team={team} clients={clients} meId={me.id} />

      <div className="flex gap-3 overflow-x-auto p-4 md:p-6">
        {DEAL_STAGES.map((stage) => {
          const column = deals.filter((d) => d.stage === stage.value);
          const total = column.reduce((sum, d) => sum + (d.value_cents ?? 0), 0);
          return (
            <section key={stage.value} className="flex w-64 shrink-0 flex-col rounded-md border bg-surface">
              <header className="flex items-baseline justify-between border-b px-3 py-2">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {stage.label} <span className="tabular font-normal">{column.length}</span>
                </h2>
                <span className="tabular text-xs text-muted-foreground">{formatCents(total)}</span>
              </header>
              <ul className="flex flex-col gap-2 p-2">
                {column.map((d) => {
                  const quiet = d.last_touch_at ? daysBetween(isoDateInZone(new Date(d.last_touch_at)), today) : null;
                  const open = d.stage !== "won" && d.stage !== "lost";
                  return (
                    <li key={d.id} className="space-y-2 rounded-md border bg-card p-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{d.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{clientName.get(d.client_id)}</p>
                        </div>
                        <OwnerAvatar initials={d.owner_id ? initials.get(d.owner_id) : null} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="tabular">{formatCents(d.value_cents)}</span>
                        {open ? (
                          <span className={cn("text-muted-foreground", (quiet == null || quiet >= 14) && "text-warning")}>
                            {quiet == null ? "No touch yet" : quiet === 0 ? "Touched today" : `${quiet}d since touch`}
                          </span>
                        ) : null}
                      </div>
                      {d.next_step ? <p className="text-xs text-muted-foreground">Next: {d.next_step}</p> : null}
                      <DealStageSelect id={d.id} stage={d.stage} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { addDays, dayBoundsUtc, daysBetween, isoDateInZone, timeLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { DEAL_STAGES } from "@/lib/labels";
import type { Client, Deal, Meeting, PipelineSummaryRow, Task } from "@/lib/db/types";
import { PageHeader, Section, EmptyState } from "@/components/ui/page-header";
import { OwnerFilter, resolveOwner } from "@/components/ui/owner-filter";
import { TaskRow } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";

const STALE_AFTER_DAYS = 14;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const { supabase, me, team } = await requireMember();
  const owner = resolveOwner((await searchParams).owner, me.id, team);
  const today = isoDateInZone();
  const weekOut = addDays(today, 7);
  const { start, end } = dayBoundsUtc(today);

  let taskQuery = supabase
    .from("tasks")
    .select("*")
    .neq("status", "closed")
    .or(`due_date.is.null,due_date.lte.${weekOut}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true });
  if (owner.ownerId) taskQuery = taskQuery.eq("owner_id", owner.ownerId);

  let meetingQuery = supabase.from("meetings").select("*").gte("starts_at", start).lt("starts_at", end).order("starts_at");
  if (owner.ownerId) meetingQuery = meetingQuery.eq("owner_id", owner.ownerId);

  let dealQuery = supabase.from("deals").select("*").not("stage", "in", "(won,lost)");
  if (owner.ownerId) dealQuery = dealQuery.eq("owner_id", owner.ownerId);

  const [tasksRes, meetingsRes, dealsRes, clientsRes] = await Promise.all([
    taskQuery,
    meetingQuery,
    dealQuery,
    supabase.from("clients").select("id, name"),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const deals = (dealsRes.data ?? []) as Deal[];
  // Built from the same owner-filtered deals as the rest of the page.
  const summary = summarizeByStage(deals);
  const clientName = new Map(((clientsRes.data ?? []) as Pick<Client, "id" | "name">[]).map((c) => [c.id, c.name]));

  const overdue = tasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const thisWeek = tasks.filter((t) => t.due_date && t.due_date > today);
  const undated = tasks.filter((t) => !t.due_date);

  const staleDeals = deals
    .map((d) => ({ ...d, quietDays: d.last_touch_at ? daysBetween(isoDateInZone(new Date(d.last_touch_at)), today) : null }))
    .filter((d) => d.quietDays == null || d.quietDays >= STALE_AFTER_DAYS)
    .sort((a, b) => (b.quietDays ?? Infinity) - (a.quietDays ?? Infinity));

  const groups = [
    { title: "Overdue", items: overdue },
    { title: "Today", items: dueToday },
    { title: "Next 7 days", items: thisWeek },
    { title: "No due date", items: undated },
  ];

  const dateLabel = new Date().toLocaleDateString("en-US", { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader title="Today" subtitle={dateLabel}>
        <OwnerFilter basePath="/" current={owner.key} team={team} meId={me.id} />
      </PageHeader>

      <PipelineStrip summary={summary} />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <Section title="Tasks">
              <EmptyState>Nothing due this week. <Link href="/work" className="underline">Add a task</Link></EmptyState>
            </Section>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <Section key={g.title} title={g.title} count={g.items.length}>
                  <ul className="divide-y">
                    {g.items.map((t) => (
                      <TaskRow key={t.id} task={t} team={team} today={today} clientName={t.client_id ? clientName.get(t.client_id) : null} />
                    ))}
                  </ul>
                </Section>
              ))
          )}
        </div>

        <div className="space-y-4">
          <Section title="Meetings today" count={meetings.length}>
            {meetings.length === 0 ? (
              <EmptyState>No meetings today.</EmptyState>
            ) : (
              <ul className="divide-y">
                {meetings.map((m) => (
                  <li key={m.id} className="px-3 py-2 text-sm">
                    <p className="tabular text-xs text-muted-foreground">{timeLabel(m.starts_at)}</p>
                    <p>{m.title}</p>
                    {m.client_id ? <p className="text-xs text-muted-foreground">{clientName.get(m.client_id)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Deals quiet ${STALE_AFTER_DAYS}+ days`} count={staleDeals.length}>
            {staleDeals.length === 0 ? (
              <EmptyState>Every open deal has been touched recently.</EmptyState>
            ) : (
              <ul className="divide-y">
                {staleDeals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{d.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{clientName.get(d.client_id)}</p>
                    </div>
                    <Badge tone="warning">{d.quietDays == null ? "Never touched" : `${d.quietDays}d`}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function summarizeByStage(deals: Deal[]): PipelineSummaryRow[] {
  const rows = new Map<Deal["stage"], PipelineSummaryRow>();
  for (const d of deals) {
    const row = rows.get(d.stage) ?? { stage: d.stage, deal_count: 0, total_cents: 0, oldest_touch: null };
    row.deal_count += 1;
    row.total_cents += d.value_cents ?? 0;
    rows.set(d.stage, row);
  }
  return [...rows.values()];
}

function PipelineStrip({ summary }: { summary: PipelineSummaryRow[] }) {
  const byStage = new Map(summary.map((s) => [s.stage, s]));
  const open = DEAL_STAGES.filter((s) => s.value !== "won" && s.value !== "lost");
  return (
    <Link href="/pipeline" className="grid grid-cols-5 divide-x border-b text-xs hover:bg-accent/40">
      {open.map((s) => {
        const row = byStage.get(s.value);
        return (
          <div key={s.value} className="px-3 py-2 md:px-6">
            <p className="text-muted-foreground">{s.label}</p>
            <p className="tabular text-sm font-medium">{formatCents(row?.total_cents ?? 0)}</p>
            <p className="tabular text-muted-foreground">{row?.deal_count ?? 0} deals</p>
          </div>
        );
      })}
    </Link>
  );
}

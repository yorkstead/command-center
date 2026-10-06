import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { isoDateInZone } from "@/lib/dates";
import { TASK_STATUSES } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { Client, Task } from "@/lib/db/types";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { OwnerFilter, resolveOwner } from "@/components/ui/owner-filter";
import { TaskRow } from "@/components/tasks/task-row";
import { QuickAddTask } from "@/components/tasks/quick-add-task";

export const metadata: Metadata = { title: "Work" };

const VIEWS = [{ value: "active", label: "Active" }, ...TASK_STATUSES, { value: "any", label: "All" }];

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ owner?: string; status?: string }> }) {
  const { supabase, me, team } = await requireMember();
  const params = await searchParams;
  const owner = resolveOwner(params.owner, me.id, team);
  const view = VIEWS.some((v) => v.value === params.status) ? params.status! : "active";

  let query = supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (owner.ownerId) query = query.eq("owner_id", owner.ownerId);
  if (view === "active") query = query.neq("status", "closed");
  else if (view !== "any") query = query.eq("status", view);

  const [tasksRes, clientsRes] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").is("archived_at", null).order("name"),
  ]);
  const tasks = (tasksRes.data ?? []) as Task[];
  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "name">[];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const today = isoDateInZone();

  return (
    <>
      <PageHeader title="Work" subtitle={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`}>
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Status">
          {VIEWS.map((v) => {
            const qs = new URLSearchParams();
            if (params.owner) qs.set("owner", params.owner);
            if (v.value !== "active") qs.set("status", v.value);
            return (
              <Link
                key={v.value}
                href={`/work${qs.size ? `?${qs}` : ""}`}
                className={cn("rounded-sm px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground", view === v.value && "bg-accent font-medium text-foreground")}
              >
                {v.label}
              </Link>
            );
          })}
        </div>
        <OwnerFilter basePath="/work" current={owner.key} team={team} meId={me.id} extraParams={{ status: params.status }} />
      </PageHeader>

      <QuickAddTask team={team} clients={clients} meId={me.id} />

      <div className="hidden grid-cols-[1fr_7rem_6rem_6.5rem_8rem_auto] gap-x-3 border-b px-7 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase md:grid">
        <span>Task</span><span>Status</span><span>Priority</span><span>Owner</span><span>Due</span><span className="w-7" />
      </div>
      {tasks.length === 0 ? (
        <EmptyState>No tasks match. Add one above.</EmptyState>
      ) : (
        <ul className="divide-y md:px-4">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} team={team} today={today} clientName={t.client_id ? clientName.get(t.client_id) : null} />
          ))}
        </ul>
      )}
    </>
  );
}

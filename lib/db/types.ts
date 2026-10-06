// Row shapes for the tables in supabase/migrations. Once the Supabase CLI is
// linked, `supabase gen types typescript` can replace these.

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "in_progress" | "closed";
export type ClientStatus = "prospect" | "active" | "paused" | "past";
export type DealStage = "lead" | "contacted" | "demo" | "proposal" | "negotiation" | "won" | "lost";

export interface Profile {
  id: string;
  display_name: string;
  initials: string;
  email: string;
  is_active: boolean;
}

export interface Client {
  id: string;
  name: string;
  status: ClientStatus;
  industry: string | null;
  city: string | null;
  owner_id: string | null;
  active_scope: string | null;
  archived_at: string | null;
}

export interface Task {
  id: string;
  title: string;
  owner_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  next_action: string | null;
  client_id: string | null;
  project_id: string | null;
  deal_id: string | null;
  meeting_id: string | null;
  updated_at: string;
}

export interface Deal {
  id: string;
  client_id: string;
  title: string;
  stage: DealStage;
  value_cents: number | null;
  owner_id: string | null;
  last_touch_at: string | null;
  next_step: string | null;
  sort_order: number;
}

export interface Meeting {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  client_id: string | null;
  owner_id: string | null;
  source: "app" | "google" | "calcom";
  cancelled_at: string | null;
}

/** The columns of calendar_connections a signed-in person may read (the rest are server-only). */
export interface CalendarStatus {
  id: string;
  account_email: string;
  calendar_id: string;
  last_synced_at: string | null;
  last_error: string | null;
  channel_expires_at: string | null;
}

export interface PipelineSummaryRow {
  stage: DealStage;
  deal_count: number;
  total_cents: number;
  oldest_touch: string | null;
}

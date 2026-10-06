-- Run once in the Supabase SQL editor (or supabase db push).
-- Dates like "today" and "overdue" follow Denver time, not UTC.
alter database postgres set timezone to 'America/Denver';

-- Yorkstead Command Center: database schema
-- Target: Supabase (Postgres 15+). Run once as a migration in the SQL editor
-- or via `supabase db push`. Order matters: types, helpers, tables, triggers,
-- security, realtime.

-- ---------------------------------------------------------------------------
-- 1. Types
-- Enums keep the dropdown values identical to the sheet so imports map 1:1.
-- ---------------------------------------------------------------------------

create type public.task_priority  as enum ('high', 'medium', 'low');
create type public.task_status    as enum ('open', 'in_progress', 'closed');
create type public.client_status  as enum ('prospect', 'active', 'paused', 'past');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'done', 'cancelled');
create type public.deal_stage     as enum ('lead', 'contacted', 'demo', 'proposal', 'negotiation', 'won', 'lost');
create type public.touch_kind     as enum ('call', 'email', 'meeting', 'demo', 'note');

-- ---------------------------------------------------------------------------
-- 2. People
-- profiles mirrors auth.users. Only rows here can use the app; the RLS
-- helper below checks membership, so a stranger who somehow signs in sees
-- nothing.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,                 -- 'Brandon', 'Eric'
  initials     text not null,                 -- 'BR', 'ER' for owner badges
  email        text not null unique,
  is_active    boolean not null default true, -- turn off instead of deleting
  created_at   timestamptz not null default now()
);

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Shared housekeeping columns
-- Every business table carries created_by / updated_by / timestamps so we
-- can always answer "who changed this and when".
-- ---------------------------------------------------------------------------

create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Clients & Projects
-- A prospect is a client row with status 'prospect'. Winning a deal flips it
-- to 'active' instead of retyping the company into a second list.
-- ---------------------------------------------------------------------------

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  status       public.client_status not null default 'prospect',
  industry     text,                          -- shop, warehouse, restaurant...
  website      text,
  city         text,
  owner_id     uuid references public.profiles (id) on delete set null,
  active_scope text,                          -- plain-language "what we're doing for them"
  notes        text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null
);
create unique index clients_name_unique on public.clients (lower(name)) where archived_at is null;
create index clients_status_idx on public.clients (status) where archived_at is null;

create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  full_name   text not null,
  role        text,                           -- 'Owner', 'Ops manager'
  email       text,
  phone       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null
);
create index contacts_client_idx on public.contacts (client_id);
-- At most one primary contact per client.
create unique index contacts_one_primary on public.contacts (client_id) where is_primary;

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete restrict,
  name          text not null,
  status        public.project_status not null default 'planning',
  owner_id      uuid references public.profiles (id) on delete set null,
  scope         text,
  value_cents   bigint check (value_cents >= 0),  -- contract value, whole cents
  start_date    date,
  target_date   date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  updated_by    uuid references public.profiles (id) on delete set null
);
create index projects_client_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status);

-- ---------------------------------------------------------------------------
-- 5. Sales Pipeline
-- deal_touchpoints is the history; deals.last_touch_at is kept current by a
-- trigger so the pipeline board can sort "gone quiet" without a join.
-- ---------------------------------------------------------------------------

create table public.deals (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete restrict,
  title             text not null,               -- 'ReWorkflow build for Acme Dock'
  stage             public.deal_stage not null default 'lead',
  value_cents       bigint check (value_cents >= 0),
  owner_id          uuid references public.profiles (id) on delete set null,
  expected_close    date,
  last_touch_at     timestamptz,
  next_step         text,
  lost_reason       text,
  project_id        uuid references public.projects (id) on delete set null, -- set when won
  stage_changed_at  timestamptz not null default now(),
  closed_at         timestamptz,
  sort_order        double precision not null default 0,  -- position within a board column
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.profiles (id) on delete set null,
  updated_by        uuid references public.profiles (id) on delete set null,
  constraint deals_lost_needs_reason check (stage <> 'lost' or lost_reason is not null)
);
create index deals_stage_idx on public.deals (stage, sort_order);
create index deals_owner_idx on public.deals (owner_id);
create index deals_client_idx on public.deals (client_id);

create table public.deal_touchpoints (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals (id) on delete cascade,
  kind        public.touch_kind not null,
  happened_at timestamptz not null default now(),
  summary     text not null,
  contact_id  uuid references public.contacts (id) on delete set null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid()
);
create index deal_touchpoints_deal_idx on public.deal_touchpoints (deal_id, happened_at desc);

create or replace function public.deal_after_touch()
returns trigger
language plpgsql
as $$
begin
  update public.deals
     set last_touch_at = greatest(coalesce(last_touch_at, new.happened_at), new.happened_at)
   where id = new.deal_id;
  return new;
end;
$$;

create or replace function public.deal_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.closed_at := case when new.stage in ('won', 'lost') then now() else null end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Meetings & Follow-ups
-- Agenda items live with the meeting. Follow-ups are NOT a separate table:
-- they are tasks with meeting_id set, so they land on the same to-do list as
-- everything else and can't be forgotten in a meeting note.
-- ---------------------------------------------------------------------------

create table public.meetings (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  location        text,                       -- address or video link
  client_id       uuid references public.clients (id) on delete set null,
  deal_id         uuid references public.deals (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  owner_id        uuid references public.profiles (id) on delete set null,
  notes           text,                       -- what was said
  external_cal_id text unique,                -- Google Calendar event id, for later sync
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_by      uuid references public.profiles (id) on delete set null,
  constraint meetings_end_after_start check (ends_at is null or ends_at > starts_at)
);
create index meetings_starts_idx on public.meetings (starts_at);
create index meetings_client_idx on public.meetings (client_id);

create table public.meeting_attendees (
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  profile_id  uuid references public.profiles (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete cascade,
  constraint attendee_is_one_person check (num_nonnulls(profile_id, contact_id) = 1)
);
create unique index meeting_attendees_profile on public.meeting_attendees (meeting_id, profile_id) where profile_id is not null;
create unique index meeting_attendees_contact on public.meeting_attendees (meeting_id, contact_id) where contact_id is not null;

create table public.agenda_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  body        text not null,
  position    integer not null default 0,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid()
);
create index agenda_items_meeting_idx on public.agenda_items (meeting_id, position);

-- ---------------------------------------------------------------------------
-- 7. Active Work (tasks)
-- One list for everything. A task can hang off a client, a project, a deal or
-- a meeting (as a follow-up), or nothing at all.
-- ---------------------------------------------------------------------------

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  owner_id     uuid references public.profiles (id) on delete set null,
  priority     public.task_priority not null default 'medium',
  status       public.task_status not null default 'open',
  due_date     date,
  next_action  text,
  client_id    uuid references public.clients (id) on delete set null,
  project_id   uuid references public.projects (id) on delete set null,
  deal_id      uuid references public.deals (id) on delete set null,
  meeting_id   uuid references public.meetings (id) on delete set null,  -- set = follow-up
  closed_at    timestamptz,
  sort_order   double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null
);
create index tasks_owner_open_idx on public.tasks (owner_id, due_date) where status <> 'closed';
create index tasks_status_idx on public.tasks (status);
create index tasks_client_idx on public.tasks (client_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_deal_idx on public.tasks (deal_id);
create index tasks_meeting_idx on public.tasks (meeting_id);

create or replace function public.task_before_write()
returns trigger
language plpgsql
as $$
begin
  -- Fill in the client from the project so filters by client always work.
  if new.project_id is not null and new.client_id is null then
    select client_id into new.client_id from public.projects where id = new.project_id;
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

create trigger clients_touch   before insert or update on public.clients   for each row execute function public.touch_row();
create trigger contacts_touch  before insert or update on public.contacts  for each row execute function public.touch_row();
create trigger projects_touch  before insert or update on public.projects  for each row execute function public.touch_row();
create trigger deals_touch     before insert or update on public.deals     for each row execute function public.touch_row();
create trigger meetings_touch  before insert or update on public.meetings  for each row execute function public.touch_row();
create trigger tasks_touch     before insert or update on public.tasks     for each row execute function public.touch_row();

create trigger deals_stage     before update on public.deals for each row execute function public.deal_before_update();
create trigger touch_updates_deal after insert on public.deal_touchpoints for each row execute function public.deal_after_touch();
create trigger tasks_rules     before insert or update on public.tasks for each row execute function public.task_before_write();

-- ---------------------------------------------------------------------------
-- 9. Row-Level Security
-- Brandon and Eric co-manage everything, so both can read and edit every
-- row. "Owner" means who's on the hook, not who's allowed to see it. The
-- only gate is: are you an active team member?
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'contacts', 'projects', 'deals', 'deal_touchpoints',
    'meetings', 'meeting_attendees', 'agenda_items', 'tasks'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy team_all on public.%I for all to authenticated
         using (public.is_team_member()) with check (public.is_team_member())', t);
  end loop;
end $$;

-- Profiles: team can read each other; you can only edit yourself.
-- Adding a person is done by hand in the Supabase dashboard (see doc).
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (public.is_team_member());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 10. Views for the dashboard (run with the caller's permissions)
-- ---------------------------------------------------------------------------

create view public.v_today with (security_invoker = true) as
select t.*,
       (t.due_date < current_date) as is_overdue,
       c.name as client_name,
       p.name as project_name
from public.tasks t
left join public.clients  c on c.id = t.client_id
left join public.projects p on p.id = t.project_id
where t.status <> 'closed'
  and (t.due_date is null or t.due_date <= current_date + 7);

create view public.v_pipeline_summary with (security_invoker = true) as
select stage,
       count(*)                       as deal_count,
       coalesce(sum(value_cents), 0)  as total_cents,
       min(last_touch_at)             as oldest_touch
from public.deals
where stage not in ('won', 'lost')
group by stage;

-- ---------------------------------------------------------------------------
-- 11. Realtime
-- Broadcast row changes on the tables people edit, so the other person's
-- screen updates without a refresh.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.tasks, public.deals, public.meetings, public.agenda_items,
  public.clients, public.projects, public.deal_touchpoints;

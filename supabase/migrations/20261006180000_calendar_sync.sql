-- Google Calendar sync (one way: the shared "Yorkstead Meetings" calendar into the app).
--   1. meetings.source and meetings.cancelled_at
--   2. calendar_connections: the connected calendar, with the encrypted Google
--      refresh token. Team members can read the status columns only; the
--      token, sync bookmark and channel secret are readable by server code alone.
--   3. Realtime on the two tables the sync writes that the first migration left out.

-- 1. Meetings. A cancelled calendar event marks the meeting cancelled instead of
--    deleting it, because it may already have notes and follow-up tasks.
--    external_cal_id holds 'google:<event id>'.
alter table public.meetings
  add column source       text not null default 'app' check (source in ('app', 'google', 'calcom')),
  add column cancelled_at timestamptz;

-- 2. Calendar connections.
create table public.calendar_connections (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  provider            text not null default 'google' check (provider = 'google'),
  account_email       text not null,   -- the Google account that connected
  calendar_id         text not null,   -- e.g. abc123@group.calendar.google.com
  refresh_token_enc   text not null,   -- AES-GCM encrypted, see lib/calendar/crypto.ts
  sync_token          text,            -- Google's "changes since" bookmark
  full_synced_at      timestamptz,     -- last full pull (weekly, to pick up far-off repeats)
  channel_id          uuid,            -- current push channel
  channel_resource_id text,
  channel_token       text,            -- shared secret Google echoes back on each ping
  channel_expires_at  timestamptz,
  last_synced_at      timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  constraint calendar_connections_one_per_calendar unique (provider, calendar_id)
);
create unique index calendar_connections_channel on public.calendar_connections (channel_id) where channel_id is not null;
create index calendar_connections_profile_idx on public.calendar_connections (profile_id);

alter table public.calendar_connections enable row level security;
create policy team_read on public.calendar_connections for select to authenticated
  using ((select private.is_team_member()));

-- Signed-in team members may read the status columns and nothing else.
-- Writes come only from the server's sync code, which uses the secret key.
revoke all on public.calendar_connections from anon, authenticated;
grant select (id, profile_id, provider, account_email, calendar_id,
              last_synced_at, last_error, channel_expires_at, created_at)
  on public.calendar_connections to authenticated;

-- 3. Realtime: the sync also writes attendees.
alter publication supabase_realtime add table public.meeting_attendees, public.contacts;

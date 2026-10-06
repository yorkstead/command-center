-- Fixes from Supabase's security and performance advisors after the first run.
-- Applied to the live project on 2026-10-06 (as three steps: functions, policies, indexes).

-- 1. Keep the team-membership check out of the public API.
--    Policies reference the function itself, so moving it keeps them working.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_team_member() set schema private;
alter function private.is_team_member() set search_path = '';
revoke execute on function private.is_team_member() from public, anon;
grant execute on function private.is_team_member() to authenticated;

-- 2. Pin search_path on trigger functions (they already use schema-qualified names).
alter function public.touch_row() set search_path = '';
alter function public.deal_after_touch() set search_path = '';
alter function public.deal_before_update() set search_path = '';
alter function public.task_before_write() set search_path = '';

-- 3. Evaluate the membership check once per query, not once per row.
alter policy team_all on public.clients using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.contacts using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.projects using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.deals using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.deal_touchpoints using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.meetings using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.meeting_attendees using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.agenda_items using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy team_all on public.tasks using ((select private.is_team_member())) with check ((select private.is_team_member()));
alter policy profiles_read on public.profiles using ((select private.is_team_member()));
alter policy profiles_self_update on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 4. Give meeting_attendees a primary key.
alter table public.meeting_attendees add column id uuid primary key default gen_random_uuid();

-- 5. Index the foreign keys the app filters or joins on.
--    (created_by / updated_by are audit columns and stay unindexed.)
create index clients_owner_idx           on public.clients (owner_id);
create index projects_owner_idx          on public.projects (owner_id);
create index deals_project_idx           on public.deals (project_id);
create index meetings_owner_idx          on public.meetings (owner_id);
create index meetings_deal_idx           on public.meetings (deal_id);
create index meetings_project_idx        on public.meetings (project_id);
create index meeting_attendees_profile_idx on public.meeting_attendees (profile_id);
create index meeting_attendees_contact_idx on public.meeting_attendees (contact_id);
create index deal_touchpoints_contact_idx  on public.deal_touchpoints (contact_id);

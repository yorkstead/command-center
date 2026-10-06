@AGENTS.md

# Command Center notes

- Design doc: the schema and decisions came from the Command Center design (tasks, pipeline, meetings, clients). Follow-ups are tasks with `meeting_id`; prospects are clients with status `prospect`; money is stored as whole cents.
- Next.js 16: middleware is `proxy.ts`; `cookies()`, `headers()`, `params` and `searchParams` are async.
- Every page and Server Action starts with `requireMember()` from `lib/auth.ts`. Never use the Supabase service-role (secret) key in request code. The one exception is the calendar sync (`lib/calendar/`, `app/api/calendar/`, `app/api/cron/`), which runs without a signed-in person and goes through `lib/supabase/admin.ts`.
- Schema changes go in a new file in `supabase/migrations/`; update `lib/db/types.ts` to match.
- Run `bun test`, `bun run lint` and `bun run typecheck` before pushing.

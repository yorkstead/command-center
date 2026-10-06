# Yorkstead Command Center

Internal operations app for Yorkstead: tasks, sales pipeline, meetings and clients in one place. Replaces the Google Sheets dashboard. Hosted at cal.yorkstead.com.

Stack: Next.js 16 (App Router), Tailwind 4, Lucide, Supabase (Postgres, Auth, Realtime, row-level security), Vercel.

## First-time setup

1. **Database.** Already done for the live project. For a fresh one, run each file in `supabase/migrations/` in order in the SQL Editor.
2. **Sign-in settings.** Authentication > Sign In / Providers: leave Email on and turn **off** "Allow new users to sign up". Authentication > URL Configuration: set Site URL to `https://cal.yorkstead.com` and add these redirect URLs: `https://cal.yorkstead.com/auth/callback`, `http://localhost:3000/auth/callback`.
3. **People.** Authentication > Users > Invite user, once for Brandon and once for Eric. Then edit the emails in `supabase/team.sql` and run it in the SQL Editor. Anyone signed in without a row in `profiles` sees nothing.
4. **Keys.** Copy `.env.example` to `.env.local` and fill in the values from Project Settings > API. Add the same two variables in Vercel.
5. **Domain.** In Vercel, add `cal.yorkstead.com` to the project, then add the CNAME it shows at your DNS host.

## Working on it

```bash
bun install
bun dev          # http://localhost:3000
bun test         # unit tests
bun run lint
bun run typecheck
```

## How it fits together

- `supabase/migrations/` is the database. Every table has row-level security: active team members can read and write everything. "Owner" means who's on the hook, not who can see it.
- `proxy.ts` keeps the sign-in session fresh and sends signed-out visitors to `/login`.
- `lib/auth.ts` `requireMember()` is called by every page and Server Action. It returns the Supabase client, the signed-in person and the team.
- `lib/actions/` holds the Server Actions (all writes). Each validates input with Zod (`lib/validation.ts`) and writes as the signed-in user, so the database's own rules still apply.
- `components/shell/realtime-refresh.tsx` listens for changes from the other person and refreshes the page.
- Dates: "today" and "overdue" are Denver time (`lib/dates.ts`, and the database timezone is set to America/Denver).

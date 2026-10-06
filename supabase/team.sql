-- Gives Brandon and Eric access to the app.
-- 1. In Supabase: Authentication > Users > Invite user, once per email.
-- 2. Replace the two emails below, then run this in the SQL editor.
-- Anyone who signs in without a row here sees nothing.

insert into public.profiles (id, display_name, initials, email)
select u.id, v.display_name, v.initials, u.email
from auth.users u
join (values
  ('brandon@yorkstead.com', 'Brandon', 'BR'),
  ('eric@yorkstead.com',    'Eric',    'ER')
) as v(email, display_name, initials) on lower(u.email) = lower(v.email)
on conflict (id) do update
  set display_name = excluded.display_name,
      initials     = excluded.initials,
      is_active    = true;

select display_name, email from public.profiles;

-- Fix staff approval lookup: staff + user_roles tables had RLS enabled with
-- ZERO policies, so every authenticated SELECT returned no rows — even the
-- approved support@localservicepro.com.au account appeared "not approved".
--
-- Add the minimum-privilege SELECT policy: an authenticated user may read
-- ONLY their own staff row (matched by user_id = auth.uid()). This does NOT
-- disable RLS, grant public/anon access, auto-approve users, or expose
-- other staff records. Unapproved users simply see no row for themselves.

-- staff: self-read only
drop policy if exists "Staff read own row" on public.staff;
create policy "Staff read own row" on public.staff
  for select to authenticated
  using (auth.uid() = user_id);

-- user_roles: self-read only (used by has_role / role checks)
drop policy if exists "User reads own roles" on public.user_roles;
create policy "User reads own roles" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id);
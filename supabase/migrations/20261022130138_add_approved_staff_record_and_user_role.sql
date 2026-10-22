-- Approve the existing Cloud user (support@localservicepro.com.au) as staff.
-- Access is gated by a row in public.staff matching the signed-in user's
-- user_id (see src/lib/auth.tsx + getStaffIdentity). The 'user' role is the
-- least-privilege app_role — no admin privileges are granted. Assignment to
-- Nathaniel/Jay (team_members) stays separate from the authenticated account.

insert into public.staff (user_id, display_name, email)
values (
  '7ab1f828-b233-4d87-ad90-e553f2b5d3b8',
  'LSP Support',
  'support@localservicepro.com.au'
)
on conflict (user_id) do update set
  display_name = excluded.display_name,
  email = excluded.email;

insert into public.user_roles (user_id, role)
values ('7ab1f828-b233-4d87-ad90-e553f2b5d3b8', 'user')
on conflict (user_id, role) do nothing;
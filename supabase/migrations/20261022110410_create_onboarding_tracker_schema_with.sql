-- LSP Onboarding Checklist — persistent shared storage for staff.
-- Clients, call sessions (with per-call item + guide snapshots), settings,
-- audit history, and approved-staff access control.

-- ---- Enums ----
create type public.call_type as enum ('connection', 'onboarding');
create type public.call_status as enum ('not_started', 'in_progress', 'needs_followup', 'completed');
create type public.item_kind as enum ('client_action', 'staff_check');
create type public.item_status as enum ('not_checked', 'done', 'needs_help', 'not_applicable');
create type public.review_outcome as enum ('recorded', 'sent', 'receipt_confirmed', 'failed', 'unknown');
create type public.guide_channel as enum ('email', 'sms', 'in_app', 'call', 'other');
create type public.app_role as enum ('admin', 'moderator', 'user');

-- ---- Approved-staff roles ----
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- ---- Staff profiles (mirror auth.users into a readable staff list) ----
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);
grant select on public.staff to authenticated;
grant all on public.staff to service_role;
alter table public.staff enable row level security;

-- ---- Clients ----
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  client_name text not null,
  assigned_team_member text not null,
  contact_details text,
  ghl_link text,
  notes text,
  next_call_type call_type,
  next_call_date date,
  is_test_record boolean not null default false,
  test_purpose text,
  account_context text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "Staff read clients" on public.clients
  for select to authenticated using (true);
create policy "Staff insert clients" on public.clients
  for insert to authenticated with check (true);
create policy "Staff update clients" on public.clients
  for update to authenticated using (true) with check (true);
create policy "Staff delete clients" on public.clients
  for delete to authenticated using (true);

-- ---- Call sessions ----
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  type call_type not null,
  call_date date not null,
  staff_member text not null,
  notes text,
  follow_up_action text,
  follow_up_owner text,
  follow_up_date date,
  finished_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.calls to authenticated;
grant all on public.calls to service_role;
alter table public.calls enable row level security;
create policy "Staff read calls" on public.calls
  for select to authenticated using (true);
create policy "Staff insert calls" on public.calls
  for insert to authenticated with check (true);
create policy "Staff update calls" on public.calls
  for update to authenticated using (true) with check (true);
create policy "Staff delete calls" on public.calls
  for delete to authenticated using (true);

-- ---- Call items (per-call snapshot of a template item) ----
create table public.call_items (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade not null,
  template_item_id text,
  label text not null,
  kind item_kind not null,
  required boolean not null default false,
  status item_status not null default 'not_checked',
  evidence text,
  completed_by text,
  completed_at timestamptz,
  issue text,
  next_action text,
  not_applicable_reason text,
  acknowledged_by_reviewer boolean,
  review_outcome review_outcome,
  review_send boolean not null default false,
  guide_derived boolean not null default false,
  help_text text,
  demo_practice boolean not null default false,
  staff_demonstrated boolean not null default false,
  staff_demonstrated_by text,
  staff_demonstrated_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.call_items to authenticated;
grant all on public.call_items to service_role;
alter table public.call_items enable row level security;
create policy "Staff read call items" on public.call_items
  for select to authenticated using (true);
create policy "Staff insert call items" on public.call_items
  for insert to authenticated with check (true);
create policy "Staff update call items" on public.call_items
  for update to authenticated using (true) with check (true);
create policy "Staff delete call items" on public.call_items
  for delete to authenticated using (true);

-- ---- Call guide delivery records ----
create table public.call_guides (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade not null,
  guide_id text not null,
  sent boolean not null default false,
  sent_at timestamptz,
  channel guide_channel,
  sent_by text,
  supplied_url_or_version text,
  walkthrough_provided boolean not null default false,
  walkthrough_at timestamptz,
  walkthrough_by text,
  walkthrough_notes text,
  not_applicable_reason text,
  acknowledged_by_reviewer boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.call_guides to authenticated;
grant all on public.call_guides to service_role;
alter table public.call_guides enable row level security;
create policy "Staff read call guides" on public.call_guides
  for select to authenticated using (true);
create policy "Staff insert call guides" on public.call_guides
  for insert to authenticated with check (true);
create policy "Staff update call guides" on public.call_guides
  for update to authenticated using (true) with check (true);
create policy "Staff delete call guides" on public.call_guides
  for delete to authenticated using (true);

-- ---- Audit trail (status changes) ----
create table public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  call_item_id uuid references public.call_items(id) on delete cascade,
  call_guide_id uuid references public.call_guides(id) on delete cascade,
  field text not null,
  from_value text,
  to_value text,
  reason text,
  actor text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_entries to authenticated;
grant all on public.audit_entries to service_role;
alter table public.audit_entries enable row level security;
create policy "Staff read audit" on public.audit_entries
  for select to authenticated using (true);
create policy "Staff insert audit" on public.audit_entries
  for insert to authenticated with check (true);

-- ---- Settings: guide links ----
create table public.guide_links (
  id text primary key,
  label text not null,
  url text,
  document_title text,
  document_version text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.guide_links to authenticated;
grant all on public.guide_links to service_role;
alter table public.guide_links enable row level security;
create policy "Staff read guide links" on public.guide_links
  for select to authenticated using (true);
create policy "Staff write guide links" on public.guide_links
  for all to authenticated using (true) with check (true);

-- ---- Settings: team members ----
create table public.team_members (
  id text primary key,
  name text not null,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
create policy "Staff read team" on public.team_members
  for select to authenticated using (true);
create policy "Staff write team" on public.team_members
  for all to authenticated using (true) with check (true);

-- ---- Settings: checklist templates ----
create table public.templates (
  id text primary key,
  call_type call_type not null,
  name text not null,
  description text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.templates to authenticated;
grant all on public.templates to service_role;
alter table public.templates enable row level security;
create policy "Staff read templates" on public.templates
  for select to authenticated using (true);
create policy "Staff write templates" on public.templates
  for all to authenticated using (true) with check (true);

create table public.template_items (
  id text primary key,
  template_id text references public.templates(id) on delete cascade not null,
  label text not null,
  kind item_kind not null,
  required boolean not null default false,
  archived boolean not null default false,
  help_text text,
  review_send boolean not null default false,
  guide_derived boolean not null default false,
  demo_practice boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.template_items to authenticated;
grant all on public.template_items to service_role;
alter table public.template_items enable row level security;
create policy "Staff read template items" on public.template_items
  for select to authenticated using (true);
create policy "Staff write template items" on public.template_items
  for all to authenticated using (true) with check (true);

-- ---- Notification log (prevent duplicate emails) ----
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  call_id uuid references public.calls(id) on delete cascade,
  recipient text not null,
  status text not null default 'pending',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_log to authenticated;
grant all on public.notification_log to service_role;
alter table public.notification_log enable row level security;
create policy "Staff read notifications" on public.notification_log
  for select to authenticated using (true);
create policy "Staff insert notifications" on public.notification_log
  for insert to authenticated with check (true);
create policy "Staff update notifications" on public.notification_log
  for update to authenticated using (true) with check (true);

-- ---- Seed default settings + the internal trial record ----
insert into public.guide_links (id, label, url, sort_order) values
  ('guide-add-lead', 'Add a lead manually in the phone app', null, 1),
  ('guide-send-review', 'Send a Google review request in the phone app', null, 2),
  ('guide-onboarding-hub', 'Existing LSP Client Onboarding hub',
    'https://scribehow.com/page/LSP__Client_Onboarding_Guide__ylTW0OJQSX6yRSyM42hHEQ', 3)
on conflict (id) do update set
  label = excluded.label,
  url = excluded.url,
  sort_order = excluded.sort_order;

insert into public.team_members (id, name, sort_order) values
  ('tm-1', 'Nathaniel', 1),
  ('tm-2', 'Jay', 2)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.templates (id, call_type, name, description) values
  ('tpl-connection', 'connection', 'Integration & Connection call',
    'Verify access and required integrations. Records verification only — does not perform integrations.'),
  ('tpl-onboarding', 'onboarding', 'Onboarding & Training call',
    'Client-led practical tasks plus staff result verification. Staff demo does not count as client completion.')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

-- Connection template items
insert into public.template_items (id, template_id, label, kind, required, sort_order) values
  ('ci-access-sub', 'tpl-connection', 'Client can access the correct LSP subaccount', 'staff_check', true, 1),
  ('ci-google', 'tpl-connection', 'Google account connected, where required', 'staff_check', true, 2),
  ('ci-gbp', 'tpl-connection', 'Correct Google Business Profile connected', 'staff_check', true, 3),
  ('ci-g-review', 'tpl-connection', 'Google review destination checked', 'staff_check', true, 4),
  ('ci-fb', 'tpl-connection', 'Facebook business page connected, where required', 'staff_check', false, 5),
  ('ci-ig', 'tpl-connection', 'Instagram connected, if included/applicable', 'staff_check', false, 6),
  ('ci-cal', 'tpl-connection', 'Calendar connected, if included/applicable', 'staff_check', false, 7),
  ('ci-other', 'tpl-connection', 'Other agreed integrations checked', 'staff_check', false, 8)
on conflict (id) do update set
  label = excluded.label,
  kind = excluded.kind,
  required = excluded.required,
  sort_order = excluded.sort_order;

-- Onboarding template items
insert into public.template_items (id, template_id, label, kind, required, sort_order, review_send, guide_derived, demo_practice) values
  ('oi-login', 'tpl-onboarding', 'Client personally logs into the phone app', 'client_action', true, 1, false, false, false),
  ('oi-select', 'tpl-onboarding', 'Client selects the correct business/subaccount', 'client_action', true, 2, false, false, false),
  ('oi-search', 'tpl-onboarding', 'Client searches existing contacts to avoid duplicates', 'client_action', true, 3, false, false, false),
  ('oi-add', 'tpl-onboarding', 'Client manually adds an agreed contact', 'client_action', true, 4, false, false, true),
  ('oi-find', 'tpl-onboarding', 'Client finds the saved contact', 'client_action', true, 5, false, false, false),
  ('oi-open', 'tpl-onboarding', 'Client opens the review-request feature', 'client_action', true, 6, false, false, false),
  ('oi-select-recipient', 'tpl-onboarding', 'Client selects the agreed recipient and previews the message', 'client_action', true, 7, false, false, false),
  ('oi-send', 'tpl-onboarding', 'Client personally sends the Google review request', 'client_action', true, 8, true, false, true),
  ('oi-staff-check', 'tpl-onboarding', 'Staff checks the recorded result', 'staff_check', true, 9, true, false, false),
  ('oi-guides', 'tpl-onboarding', 'Required how-to guides supplied', 'staff_check', true, 10, false, true, false),
  ('oi-questions', 'tpl-onboarding', 'Client questions answered and next steps agreed', 'staff_check', true, 11, false, false, false)
on conflict (id) do update set
  label = excluded.label,
  kind = excluded.kind,
  required = excluded.required,
  sort_order = excluded.sort_order,
  review_send = excluded.review_send,
  guide_derived = excluded.guide_derived,
  demo_practice = excluded.demo_practice;

-- Seed the internal trial client (Nathaniel, assigned to Jay). Never pre-completed.
insert into public.clients (id, business_name, client_name, assigned_team_member, notes, is_test_record, test_purpose, account_context, next_call_type)
values (
  'a0000000-0000-4000-8000-0000000000a1',
  'LSP Trial — Onboarding Test',
  'Nathaniel',
  'Jay',
  'Internal test record. Nathaniel performs the client-side tasks while Jay observes and records evidence.',
  true,
  'Nathaniel performs the client-side tasks while Jay observes and records evidence.',
  'LSP Trial subaccount',
  'onboarding'
)
on conflict (id) do update set
  business_name = excluded.business_name,
  client_name = excluded.client_name,
  assigned_team_member = excluded.assigned_team_member,
  is_test_record = excluded.is_test_record,
  test_purpose = excluded.test_purpose,
  account_context = excluded.account_context;
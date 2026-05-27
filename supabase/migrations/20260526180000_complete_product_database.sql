-- Complete product database: audit, engagement, attendance, impersonation, analytics columns, RBAC.

-- Align organization lifecycle with backend API (uses 'suspended').
alter type public.organization_status add value if not exists 'suspended';

-- Audit trail
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "developers can read audit logs" on public.audit_logs;
create policy "developers can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (app_private.is_developer() or app_private.is_super_admin());

drop policy if exists "org admins can read org audit logs" on public.audit_logs;
create policy "org admins can read org audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    organization_id is not null
    and app_private.has_org_role(organization_id, array['admin', 'branch_manager']::public.org_member_role[])
  );

-- Student notes
create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  test_id uuid references public.tests (id) on delete set null,
  question_id uuid,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_notes_student_idx on public.student_notes (student_id, created_at desc);
alter table public.student_notes enable row level security;

drop policy if exists "students manage own notes" on public.student_notes;
create policy "students manage own notes"
  on public.student_notes
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Student bookmarks
create table if not exists public.student_bookmarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  test_id uuid references public.tests (id) on delete set null,
  question_id uuid,
  label text,
  created_at timestamptz not null default now(),
  unique (student_id, question_id)
);

alter table public.student_bookmarks enable row level security;

drop policy if exists "students manage own bookmarks" on public.student_bookmarks;
create policy "students manage own bookmarks"
  on public.student_bookmarks
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Notification preferences (replaces local-only storage)
create table if not exists public.student_notification_preferences (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  rank_alerts boolean not null default true,
  revision_reminders boolean not null default true,
  email_digest boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.student_notification_preferences enable row level security;

drop policy if exists "students manage own notification prefs" on public.student_notification_preferences;
create policy "students manage own notification prefs"
  on public.student_notification_preferences
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Batch attendance
create table if not exists public.batch_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  session_date date not null,
  status text not null default 'present' check (status in ('present', 'absent', 'late')),
  marked_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (batch_id, student_id, session_date)
);

create index if not exists batch_attendance_org_date_idx
  on public.batch_attendance (organization_id, session_date desc);

alter table public.batch_attendance enable row level security;

drop policy if exists "org admins manage batch attendance" on public.batch_attendance;
create policy "org admins manage batch attendance"
  on public.batch_attendance
  for all
  to authenticated
  using (
    app_private.has_org_role(organization_id, array['admin', 'branch_manager', 'teacher']::public.org_member_role[])
  )
  with check (
    app_private.has_org_role(organization_id, array['admin', 'branch_manager', 'teacher']::public.org_member_role[])
  );

drop policy if exists "students read own attendance" on public.batch_attendance;
create policy "students read own attendance"
  on public.batch_attendance
  for select
  to authenticated
  using (student_id = auth.uid());

-- Support impersonation audit trail
create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  reason text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists impersonation_sessions_actor_idx
  on public.impersonation_sessions (actor_id, started_at desc);

alter table public.impersonation_sessions enable row level security;

drop policy if exists "developers read impersonation sessions" on public.impersonation_sessions;
create policy "developers read impersonation sessions"
  on public.impersonation_sessions
  for select
  to authenticated
  using (app_private.is_developer() or app_private.is_super_admin());

-- Denormalized analytics on graded answers
alter table public.test_attempt_answers
  add column if not exists topic_name text,
  add column if not exists subject text;

update public.test_attempt_answers as answers
set
  topic_name = questions.topic_name,
  subject = questions.subject
from public.jee_questions as questions
where answers.question_id = questions.id
  and (answers.topic_name is null or answers.subject is null);

-- Plans used by checkout UI
insert into public.plans (slug, name, audience, price_monthly_inr, seat_limit, is_active)
values
  ('student-monthly', 'Student Monthly', 'student', 299, null, true),
  ('organization-450', 'Organization 450 Seats', 'organization', 49999, 450, true)
on conflict (slug) do update set
  name = excluded.name,
  audience = excluded.audience,
  price_monthly_inr = excluded.price_monthly_inr,
  seat_limit = excluded.seat_limit,
  is_active = excluded.is_active;

-- RBAC: org settings permission
insert into public.permissions (code, description)
values ('org.settings.manage', 'Manage organization settings and branding')
on conflict (code) do nothing;

insert into public.role_permissions (role_key, permission_code)
values
  ('super_admin', 'org.settings.manage'),
  ('admin', 'org.settings.manage')
on conflict do nothing;

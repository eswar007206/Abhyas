-- Phase 1 product foundation: audit trail, plan seeds, student engagement tables.

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

create policy "developers can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (app_private.is_developer() or app_private.is_super_admin());

create policy "org admins can read org audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    organization_id is not null
    and app_private.has_org_role(organization_id, array['admin', 'branch_manager']::public.org_member_role[])
  );

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

create policy "students manage own notes"
  on public.student_notes
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

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

create policy "students manage own bookmarks"
  on public.student_bookmarks
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

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

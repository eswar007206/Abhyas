-- Repair migration: seeds, RLS, and app_private helpers missed by partial applies.

alter table public.subscriptions
  add column if not exists razorpay_subscription_id text,
  add column if not exists seat_count integer,
  add column if not exists billing_cycle text;

insert into public.permissions (code, description) values
  ('platform.orgs.manage', 'Create and manage organizations'),
  ('platform.billing.manage', 'Platform billing and subscriptions'),
  ('platform.support.impersonate', 'Impersonate organization admins'),
  ('org.students.create', 'Create organization students'),
  ('org.students.manage', 'Manage organization students'),
  ('org.seats.view', 'View seat usage'),
  ('org.billing.manage', 'Organization billing'),
  ('org.batches.manage', 'Manage batches'),
  ('org.teachers.manage', 'Manage teachers'),
  ('org.tests.create', 'Create organization tests'),
  ('content.questions.manage', 'Manage global question bank')
on conflict (code) do nothing;

insert into public.role_permissions (role_key, permission_code) values
  ('super_admin', 'platform.orgs.manage'),
  ('super_admin', 'platform.billing.manage'),
  ('super_admin', 'platform.support.impersonate'),
  ('super_admin', 'content.questions.manage'),
  ('super_admin', 'org.students.create'),
  ('super_admin', 'org.students.manage'),
  ('super_admin', 'org.seats.view'),
  ('super_admin', 'org.billing.manage'),
  ('super_admin', 'org.batches.manage'),
  ('super_admin', 'org.teachers.manage'),
  ('super_admin', 'org.tests.create'),
  ('support_staff', 'platform.support.impersonate'),
  ('support_staff', 'org.seats.view'),
  ('content_team', 'content.questions.manage'),
  ('admin', 'org.students.create'),
  ('admin', 'org.students.manage'),
  ('admin', 'org.seats.view'),
  ('admin', 'org.billing.manage'),
  ('admin', 'org.batches.manage'),
  ('admin', 'org.teachers.manage'),
  ('admin', 'org.tests.create'),
  ('teacher', 'org.tests.create'),
  ('teacher', 'org.batches.manage'),
  ('branch_manager', 'org.students.create'),
  ('branch_manager', 'org.students.manage'),
  ('branch_manager', 'org.seats.view'),
  ('branch_manager', 'org.batches.manage')
on conflict do nothing;

insert into public.platform_user_roles (user_id, role)
select profiles.id, 'super_admin'::public.platform_role
from public.profiles
where profiles.role = 'developer'
on conflict do nothing;

create or replace function app_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_developer()
    or exists (
      select 1
      from public.platform_user_roles
      where user_id = (select auth.uid())
        and role = 'super_admin'
    );
$$;

create or replace function app_private.has_platform_role(target_role public.platform_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_super_admin()
    or exists (
      select 1
      from public.platform_user_roles
      where user_id = (select auth.uid())
        and role = target_role
    );
$$;

create or replace function app_private.has_org_role(
  target_organization_id uuid,
  allowed_roles public.org_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where user_id = (select auth.uid())
        and organization_id = target_organization_id
        and status = 'active'
        and role = any (allowed_roles)
    );
$$;

create or replace function app_private.can_add_org_student(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations
    where id = target_organization_id
      and active_students < seat_limit
  );
$$;

alter table public.batches enable row level security;
alter table public.batch_enrollments enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.platform_user_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "users can read allowed batches" on public.batches;
create policy "users can read allowed batches"
on public.batches for select to authenticated
using (
  app_private.is_super_admin()
  or app_private.has_org_role(organization_id, array['admin', 'teacher', 'branch_manager']::public.org_member_role[])
  or (
    app_private.is_org_member(organization_id)
    and exists (
      select 1 from public.batch_enrollments
      where batch_enrollments.batch_id = batches.id
        and batch_enrollments.student_id = (select auth.uid())
    )
  )
);

drop policy if exists "org managers can manage batches" on public.batches;
create policy "org managers can manage batches"
on public.batches for all to authenticated
using (
  app_private.is_super_admin()
  or app_private.has_org_role(organization_id, array['admin', 'teacher', 'branch_manager']::public.org_member_role[])
)
with check (
  app_private.is_super_admin()
  or app_private.has_org_role(organization_id, array['admin', 'teacher', 'branch_manager']::public.org_member_role[])
);

drop policy if exists "users can read allowed batch enrollments" on public.batch_enrollments;
create policy "users can read allowed batch enrollments"
on public.batch_enrollments for select to authenticated
using (
  student_id = (select auth.uid())
  or app_private.is_super_admin()
  or exists (
    select 1 from public.batches
    where batches.id = batch_enrollments.batch_id
      and app_private.has_org_role(
        batches.organization_id,
        array['admin', 'teacher', 'branch_manager']::public.org_member_role[]
      )
  )
);

drop policy if exists "org managers can manage batch enrollments" on public.batch_enrollments;
create policy "org managers can manage batch enrollments"
on public.batch_enrollments for all to authenticated
using (
  app_private.is_super_admin()
  or exists (
    select 1 from public.batches
    where batches.id = batch_enrollments.batch_id
      and app_private.has_org_role(
        batches.organization_id,
        array['admin', 'branch_manager']::public.org_member_role[]
      )
  )
)
with check (
  app_private.is_super_admin()
  or exists (
    select 1 from public.batches
    where batches.id = batch_enrollments.batch_id
      and app_private.has_org_role(
        batches.organization_id,
        array['admin', 'branch_manager']::public.org_member_role[]
      )
  )
);

drop policy if exists "users can read allowed teacher profiles" on public.teacher_profiles;
create policy "users can read allowed teacher profiles"
on public.teacher_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_super_admin()
  or app_private.is_org_member(organization_id)
);

drop policy if exists "org admins can manage teacher profiles" on public.teacher_profiles;
create policy "org admins can manage teacher profiles"
on public.teacher_profiles for all to authenticated
using (
  app_private.is_super_admin()
  or app_private.has_org_role(organization_id, array['admin']::public.org_member_role[])
)
with check (
  app_private.is_super_admin()
  or app_private.has_org_role(organization_id, array['admin']::public.org_member_role[])
);

drop policy if exists "users can read allowed payments" on public.payments;
create policy "users can read allowed payments"
on public.payments for select to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_super_admin()
  or (
    organization_id is not null
    and app_private.has_org_role(organization_id, array['admin']::public.org_member_role[])
  )
);

drop policy if exists "super admins manage payments" on public.payments;
create policy "super admins manage payments"
on public.payments for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

drop policy if exists "users can read allowed invoices" on public.invoices;
create policy "users can read allowed invoices"
on public.invoices for select to authenticated
using (
  app_private.is_super_admin()
  or exists (
    select 1 from public.payments
    where payments.id = invoices.payment_id
      and (
        payments.user_id = (select auth.uid())
        or (
          payments.organization_id is not null
          and app_private.has_org_role(payments.organization_id, array['admin']::public.org_member_role[])
        )
      )
  )
);

drop policy if exists "super admins read webhook events" on public.payment_webhook_events;
create policy "super admins read webhook events"
on public.payment_webhook_events for select to authenticated
using (app_private.is_super_admin());

drop policy if exists "authenticated read permissions catalog" on public.permissions;
create policy "authenticated read permissions catalog"
on public.permissions for select to authenticated
using (true);

drop policy if exists "authenticated read role permissions" on public.role_permissions;
create policy "authenticated read role permissions"
on public.role_permissions for select to authenticated
using (true);

drop policy if exists "users read own platform roles" on public.platform_user_roles;
create policy "users read own platform roles"
on public.platform_user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_super_admin()
);

drop policy if exists "super admins manage platform roles" on public.platform_user_roles;
create policy "super admins manage platform roles"
on public.platform_user_roles for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

revoke all on public.payment_webhook_events from anon, authenticated;
grant select on public.payment_webhook_events to service_role;

-- Multi-tenant organization foundation: subdomain, seat counters, login aliases.

alter table public.organizations
  add column if not exists subdomain text,
  add column if not exists plan_slug text,
  add column if not exists active_students integer not null default 0,
  add column if not exists branding jsonb not null default '{}'::jsonb,
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;

create unique index if not exists organizations_subdomain_lower_key
  on public.organizations (lower(subdomain))
  where subdomain is not null;

update public.organizations as organizations
set active_students = membership_counts.student_count
from (
  select
    organization_memberships.organization_id,
    count(*)::integer as student_count
  from public.organization_memberships
  where organization_memberships.role = 'student'
    and organization_memberships.status = 'active'
  group by organization_memberships.organization_id
) as membership_counts
where organizations.id = membership_counts.organization_id;

create or replace function app_private.sync_organization_active_students()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
begin
  if tg_op = 'DELETE' then
    target_org_id := old.organization_id;
  else
    target_org_id := new.organization_id;
  end if;

  update public.organizations
  set
    active_students = (
      select count(*)::integer
      from public.organization_memberships
      where organization_id = target_org_id
        and role = 'student'
        and status = 'active'
    ),
    updated_at = now()
  where id = target_org_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_memberships_sync_active_students on public.organization_memberships;

create trigger organization_memberships_sync_active_students
after insert or update or delete on public.organization_memberships
for each row
execute function app_private.sync_organization_active_students();

create table if not exists public.user_login_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  alias_local text not null,
  login_email text not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, alias_local),
  unique (login_email)
);

comment on table public.user_login_aliases is
  'Tenant-scoped login aliases such as alakh@unacademy.abhyas.in mapped to auth users.';

create index if not exists user_login_aliases_user_id_idx
  on public.user_login_aliases (user_id);

create index if not exists user_login_aliases_organization_id_idx
  on public.user_login_aliases (organization_id);

alter table public.user_login_aliases enable row level security;

drop policy if exists "users can read allowed login aliases" on public.user_login_aliases;
create policy "users can read allowed login aliases"
on public.user_login_aliases
for select
to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_developer()
  or app_private.is_org_admin(organization_id)
);

drop policy if exists "developers can manage login aliases" on public.user_login_aliases;
create policy "developers can manage login aliases"
on public.user_login_aliases
for all
to authenticated
using (app_private.is_developer())
with check (app_private.is_developer());

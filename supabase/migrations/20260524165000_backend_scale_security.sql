-- Harden Abhyas for server-owned grading and cached rankings.

alter table public.test_attempts
  add column if not exists client_attempt_id text;

create unique index if not exists test_attempts_student_client_attempt_key
  on public.test_attempts (student_id, client_attempt_id)
  where client_attempt_id is not null;

create index if not exists test_attempts_student_submitted_idx
  on public.test_attempts (student_id, submitted_at desc);

create index if not exists test_attempts_org_submitted_idx
  on public.test_attempts (organization_id, submitted_at desc)
  where organization_id is not null;

create index if not exists test_attempts_test_score_submitted_idx
  on public.test_attempts (test_id, score desc, submitted_at asc);

create index if not exists test_attempts_exam_score_submitted_idx
  on public.test_attempts (exam_id, score desc, submitted_at asc);

create table if not exists public.test_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_option text check (selected_option is null or selected_option in ('A', 'B', 'C', 'D')),
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  marks_awarded integer not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  unique (attempt_id, position)
);

comment on table public.test_attempt_answers is 'Server-graded per-question answers for each submitted test attempt.';

create index if not exists test_attempt_answers_attempt_id_idx
  on public.test_attempt_answers (attempt_id);

create index if not exists test_attempt_answers_question_id_idx
  on public.test_attempt_answers (question_id);

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('all_india', 'organization')),
  exam_id uuid not null references public.exams (id) on delete cascade,
  exam_slug text not null,
  organization_id uuid references public.organizations (id) on delete cascade,
  organization_name text,
  test_id uuid not null references public.tests (id) on delete cascade,
  test_title text not null,
  attempt_id uuid not null references public.test_attempts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  score integer not null,
  max_score integer not null,
  submitted_at timestamptz not null,
  rank_snapshot integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, attempt_id)
);

comment on table public.leaderboard_entries is 'Cached leaderboard rows used instead of live window ranking scans over all attempts.';

create index if not exists leaderboard_entries_all_india_idx
  on public.leaderboard_entries (scope, exam_id, rank_snapshot, score desc)
  where scope = 'all_india';

create index if not exists leaderboard_entries_org_idx
  on public.leaderboard_entries (scope, organization_id, exam_id, rank_snapshot, score desc)
  where scope = 'organization';

create index if not exists leaderboard_entries_attempt_id_idx
  on public.leaderboard_entries (attempt_id);

create or replace function public.refresh_leaderboards_for_attempt(attempt_id_input uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attempt_row public.test_attempts%rowtype;
  profile_row public.profiles%rowtype;
  exam_row public.exams%rowtype;
  test_row public.tests%rowtype;
  organization_row public.organizations%rowtype;
  all_india_rank integer;
  organization_rank integer;
begin
  select * into attempt_row
  from public.test_attempts
  where id = attempt_id_input;

  if attempt_row.id is null then
    raise exception 'attempt not found';
  end if;

  select * into profile_row from public.profiles where id = attempt_row.student_id;
  select * into exam_row from public.exams where id = attempt_row.exam_id;
  select * into test_row from public.tests where id = attempt_row.test_id;

  select count(*) + 1 into all_india_rank
  from public.test_attempts as ranked_attempts
  where ranked_attempts.exam_id = attempt_row.exam_id
    and (
      ranked_attempts.score > attempt_row.score
      or (
        ranked_attempts.score = attempt_row.score
        and ranked_attempts.submitted_at < attempt_row.submitted_at
      )
    );

  insert into public.leaderboard_entries (
    scope,
    exam_id,
    exam_slug,
    organization_id,
    organization_name,
    test_id,
    test_title,
    attempt_id,
    student_id,
    full_name,
    score,
    max_score,
    submitted_at,
    rank_snapshot,
    updated_at
  )
  values (
    'all_india',
    attempt_row.exam_id,
    exam_row.slug,
    null,
    null,
    attempt_row.test_id,
    test_row.title,
    attempt_row.id,
    attempt_row.student_id,
    profile_row.full_name,
    attempt_row.score,
    attempt_row.max_score,
    attempt_row.submitted_at,
    all_india_rank,
    now()
  )
  on conflict (scope, attempt_id) do update set
    score = excluded.score,
    max_score = excluded.max_score,
    rank_snapshot = excluded.rank_snapshot,
    submitted_at = excluded.submitted_at,
    updated_at = now();

  if attempt_row.organization_id is not null then
    select * into organization_row
    from public.organizations
    where id = attempt_row.organization_id;

    select count(*) + 1 into organization_rank
    from public.test_attempts as ranked_attempts
    where ranked_attempts.organization_id = attempt_row.organization_id
      and ranked_attempts.exam_id = attempt_row.exam_id
      and (
        ranked_attempts.score > attempt_row.score
        or (
          ranked_attempts.score = attempt_row.score
          and ranked_attempts.submitted_at < attempt_row.submitted_at
        )
      );

    insert into public.leaderboard_entries (
      scope,
      exam_id,
      exam_slug,
      organization_id,
      organization_name,
      test_id,
      test_title,
      attempt_id,
      student_id,
      full_name,
      score,
      max_score,
      submitted_at,
      rank_snapshot,
      updated_at
    )
    values (
      'organization',
      attempt_row.exam_id,
      exam_row.slug,
      attempt_row.organization_id,
      organization_row.name,
      attempt_row.test_id,
      test_row.title,
      attempt_row.id,
      attempt_row.student_id,
      profile_row.full_name,
      attempt_row.score,
      attempt_row.max_score,
      attempt_row.submitted_at,
      organization_rank,
      now()
    )
    on conflict (scope, attempt_id) do update set
      score = excluded.score,
      max_score = excluded.max_score,
      rank_snapshot = excluded.rank_snapshot,
      submitted_at = excluded.submitted_at,
      updated_at = now();
  end if;
end;
$$;

revoke all on function public.refresh_leaderboards_for_attempt(uuid) from anon, authenticated;
grant execute on function public.refresh_leaderboards_for_attempt(uuid) to service_role;

create or replace view public.practice_questions
with (security_invoker = true)
as
select
  questions.id,
  questions.exam_id,
  questions.question_text,
  questions.option_a,
  questions.option_b,
  questions.option_c,
  questions.option_d,
  questions.subject,
  questions.topic_name,
  questions.difficulty,
  questions.created_at
from public.questions as questions;

create or replace view public.all_india_rankings
with (security_invoker = true)
as
select
  leaderboard_entries.attempt_id,
  leaderboard_entries.student_id,
  leaderboard_entries.full_name,
  leaderboard_entries.exam_slug,
  leaderboard_entries.test_title,
  leaderboard_entries.score,
  leaderboard_entries.max_score,
  leaderboard_entries.submitted_at,
  leaderboard_entries.rank_snapshot::bigint as rank
from public.leaderboard_entries
where leaderboard_entries.scope = 'all_india';

create or replace view public.organization_rankings
with (security_invoker = true)
as
select
  leaderboard_entries.attempt_id,
  leaderboard_entries.organization_id,
  leaderboard_entries.organization_name,
  leaderboard_entries.student_id,
  leaderboard_entries.full_name,
  leaderboard_entries.exam_slug,
  leaderboard_entries.test_title,
  leaderboard_entries.score,
  leaderboard_entries.max_score,
  leaderboard_entries.submitted_at,
  leaderboard_entries.rank_snapshot::bigint as rank
from public.leaderboard_entries
where leaderboard_entries.scope = 'organization';

alter table public.test_attempt_answers enable row level security;
alter table public.leaderboard_entries enable row level security;

drop policy if exists "users can read attempt answers" on public.test_attempt_answers;
create policy "users can read attempt answers"
on public.test_attempt_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.test_attempts
    where test_attempts.id = test_attempt_answers.attempt_id
      and (
        test_attempts.student_id = (select auth.uid())
        or app_private.is_developer()
        or (
          test_attempts.organization_id is not null
          and app_private.is_org_admin(test_attempts.organization_id)
        )
      )
  )
);

drop policy if exists "users can read allowed leaderboard entries" on public.leaderboard_entries;
create policy "users can read allowed leaderboard entries"
on public.leaderboard_entries
for select
to authenticated
using (
  scope = 'all_india'
  or app_private.is_developer()
  or (
    organization_id is not null
    and app_private.is_org_member(organization_id)
  )
);

drop policy if exists "students and developers can insert attempts" on public.test_attempts;
drop policy if exists "developers can insert attempts" on public.test_attempts;
create policy "developers can insert attempts"
on public.test_attempts
for insert
to authenticated
with check (app_private.is_developer());

revoke select on public.questions from anon, authenticated;
grant select on public.practice_questions to authenticated;
grant select on public.all_india_rankings to authenticated;
grant select on public.organization_rankings to authenticated;

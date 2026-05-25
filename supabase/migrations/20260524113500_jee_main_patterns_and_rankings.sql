-- Add configurable JEE Main patterns, numerical answers, and richer cached ranking scopes.

alter table public.profiles
  add column if not exists state text,
  add column if not exists city text;

create index if not exists profiles_state_city_idx
  on public.profiles (state, city)
  where state is not null or city is not null;

alter table public.questions
  add column if not exists question_type text not null default 'mcq',
  add column if not exists numerical_answer text,
  add column if not exists numerical_tolerance numeric not null default 0,
  add column if not exists correct_marks integer not null default 4,
  add column if not exists wrong_marks integer not null default -1;

alter table public.questions
  alter column option_a drop not null,
  alter column option_b drop not null,
  alter column option_c drop not null,
  alter column option_d drop not null,
  alter column correct_option drop not null;

alter table public.questions
  drop constraint if exists questions_correct_option_check,
  drop constraint if exists questions_answer_shape_check;

alter table public.questions
  add constraint questions_answer_shape_check
  check (
    (
      question_type = 'mcq'
      and correct_option in ('A', 'B', 'C', 'D')
    )
    or (
      question_type = 'numerical'
      and numerical_answer is not null
    )
  );

alter table public.tests
  add column if not exists pattern_config jsonb not null default '{
    "exam": "jee_main",
    "durationMinutes": 180,
    "totalQuestions": 75,
    "subjects": [
      { "name": "Physics", "mcq": 20, "numerical": 5, "marks": 100 },
      { "name": "Chemistry", "mcq": 20, "numerical": 5, "marks": 100 },
      { "name": "Mathematics", "mcq": 20, "numerical": 5, "marks": 100 }
    ],
    "marks": {
      "mcqCorrect": 4,
      "mcqWrong": -1,
      "numericalCorrect": 4,
      "numericalWrong": 0
    }
  }'::jsonb,
  add column if not exists average_rank_min_tests integer not null default 30;

alter table public.test_attempt_answers
  add column if not exists question_type text not null default 'mcq',
  add column if not exists selected_answer text,
  add column if not exists correct_answer text;

update public.test_attempt_answers
set
  selected_answer = coalesce(selected_answer, selected_option),
  correct_answer = coalesce(correct_answer, correct_option);

alter table public.test_attempt_answers
  drop constraint if exists test_attempt_answers_correct_option_check,
  drop constraint if exists test_attempt_answers_selected_option_check,
  drop constraint if exists test_attempt_answers_answer_shape_check;

alter table public.test_attempt_answers
  alter column correct_option drop not null;

alter table public.test_attempt_answers
  add constraint test_attempt_answers_answer_shape_check
  check (
    question_type in ('mcq', 'numerical')
    and correct_answer is not null
    and (
      selected_option is null
      or selected_option in ('A', 'B', 'C', 'D')
    )
  );

alter table public.leaderboard_entries
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists previous_rank_snapshot integer,
  add column if not exists rank_delta integer,
  add column if not exists average_score numeric,
  add column if not exists attempt_count integer;

alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_scope_check;

update public.leaderboard_entries
set scope = 'all_india_raw'
where scope = 'all_india';

update public.leaderboard_entries
set scope = 'organization_raw'
where scope = 'organization';

alter table public.leaderboard_entries
  add constraint leaderboard_entries_scope_check
  check (
    scope in (
      'all_india_raw',
      'state_raw',
      'city_raw',
      'organization_raw',
      'all_india_average',
      'state_average',
      'city_average',
      'organization_average'
    )
  );

create index if not exists leaderboard_entries_scope_state_idx
  on public.leaderboard_entries (scope, state, exam_id, rank_snapshot, score desc)
  where state is not null;

create index if not exists leaderboard_entries_scope_city_idx
  on public.leaderboard_entries (scope, city, exam_id, rank_snapshot, score desc)
  where city is not null;

create index if not exists leaderboard_entries_student_scope_idx
  on public.leaderboard_entries (student_id, scope, exam_id, submitted_at desc);

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
  scope_name text;
  current_rank integer;
  previous_rank integer;
  current_average numeric;
  current_attempt_count integer;
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

  if attempt_row.organization_id is not null then
    select * into organization_row
    from public.organizations
    where id = attempt_row.organization_id;
  end if;

  foreach scope_name in array array['all_india_raw', 'state_raw', 'city_raw', 'organization_raw']
  loop
    if scope_name = 'state_raw' and profile_row.state is null then
      continue;
    end if;

    if scope_name = 'city_raw' and profile_row.city is null then
      continue;
    end if;

    if scope_name = 'organization_raw' and attempt_row.organization_id is null then
      continue;
    end if;

    select count(*) + 1 into current_rank
    from public.test_attempts as ranked_attempts
    join public.profiles as ranked_profiles
      on ranked_profiles.id = ranked_attempts.student_id
    where ranked_attempts.exam_id = attempt_row.exam_id
      and (
        scope_name = 'all_india_raw'
        or (scope_name = 'state_raw' and ranked_profiles.state = profile_row.state)
        or (scope_name = 'city_raw' and ranked_profiles.city = profile_row.city)
        or (
          scope_name = 'organization_raw'
          and ranked_attempts.organization_id = attempt_row.organization_id
        )
      )
      and (
        ranked_attempts.score > attempt_row.score
        or (
          ranked_attempts.score = attempt_row.score
          and ranked_attempts.submitted_at < attempt_row.submitted_at
        )
      );

    select leaderboard_entries.rank_snapshot into previous_rank
    from public.leaderboard_entries
    where leaderboard_entries.scope = scope_name
      and leaderboard_entries.exam_id = attempt_row.exam_id
      and leaderboard_entries.student_id = attempt_row.student_id
    order by leaderboard_entries.submitted_at desc
    limit 1;

    insert into public.leaderboard_entries (
      scope,
      exam_id,
      exam_slug,
      organization_id,
      organization_name,
      state,
      city,
      test_id,
      test_title,
      attempt_id,
      student_id,
      full_name,
      score,
      max_score,
      submitted_at,
      rank_snapshot,
      previous_rank_snapshot,
      rank_delta,
      updated_at
    )
    values (
      scope_name,
      attempt_row.exam_id,
      exam_row.slug,
      case when scope_name = 'organization_raw' then attempt_row.organization_id else null end,
      case when scope_name = 'organization_raw' then organization_row.name else null end,
      case when scope_name in ('state_raw', 'city_raw') then profile_row.state else null end,
      case when scope_name = 'city_raw' then profile_row.city else null end,
      attempt_row.test_id,
      test_row.title,
      attempt_row.id,
      attempt_row.student_id,
      profile_row.full_name,
      attempt_row.score,
      attempt_row.max_score,
      attempt_row.submitted_at,
      current_rank,
      previous_rank,
      case when previous_rank is null then null else previous_rank - current_rank end,
      now()
    )
    on conflict (scope, attempt_id) do update set
      score = excluded.score,
      max_score = excluded.max_score,
      rank_snapshot = excluded.rank_snapshot,
      previous_rank_snapshot = excluded.previous_rank_snapshot,
      rank_delta = excluded.rank_delta,
      submitted_at = excluded.submitted_at,
      updated_at = now();
  end loop;

  select avg(score), count(*) into current_average, current_attempt_count
  from public.test_attempts
  where student_id = attempt_row.student_id
    and exam_id = attempt_row.exam_id;

  if current_attempt_count >= 30 then
    foreach scope_name in array array[
      'all_india_average',
      'state_average',
      'city_average',
      'organization_average'
    ]
    loop
      if scope_name = 'state_average' and profile_row.state is null then
        continue;
      end if;

      if scope_name = 'city_average' and profile_row.city is null then
        continue;
      end if;

      if scope_name = 'organization_average' and attempt_row.organization_id is null then
        continue;
      end if;

      select count(*) + 1 into current_rank
      from (
        select
          ranked_attempts.student_id,
          avg(ranked_attempts.score) as average_score,
          max(ranked_attempts.submitted_at) as latest_attempt_at
        from public.test_attempts as ranked_attempts
        join public.profiles as ranked_profiles
          on ranked_profiles.id = ranked_attempts.student_id
        where ranked_attempts.exam_id = attempt_row.exam_id
          and (
            scope_name = 'all_india_average'
            or (scope_name = 'state_average' and ranked_profiles.state = profile_row.state)
            or (scope_name = 'city_average' and ranked_profiles.city = profile_row.city)
            or (
              scope_name = 'organization_average'
              and ranked_attempts.organization_id = attempt_row.organization_id
            )
          )
        group by ranked_attempts.student_id
        having count(*) >= 30
      ) as ranked_students
      where ranked_students.student_id <> attempt_row.student_id
        and (
          ranked_students.average_score > current_average
          or (
            ranked_students.average_score = current_average
            and ranked_students.latest_attempt_at < attempt_row.submitted_at
          )
        );

      select leaderboard_entries.rank_snapshot into previous_rank
      from public.leaderboard_entries
      where leaderboard_entries.scope = scope_name
        and leaderboard_entries.exam_id = attempt_row.exam_id
        and leaderboard_entries.student_id = attempt_row.student_id
      order by leaderboard_entries.submitted_at desc
      limit 1;

      insert into public.leaderboard_entries (
        scope,
        exam_id,
        exam_slug,
        organization_id,
        organization_name,
        state,
        city,
        test_id,
        test_title,
        attempt_id,
        student_id,
        full_name,
        score,
        max_score,
        submitted_at,
        rank_snapshot,
        previous_rank_snapshot,
        rank_delta,
        average_score,
        attempt_count,
        updated_at
      )
      values (
        scope_name,
        attempt_row.exam_id,
        exam_row.slug,
        case when scope_name = 'organization_average' then attempt_row.organization_id else null end,
        case when scope_name = 'organization_average' then organization_row.name else null end,
        case when scope_name in ('state_average', 'city_average') then profile_row.state else null end,
        case when scope_name = 'city_average' then profile_row.city else null end,
        attempt_row.test_id,
        test_row.title,
        attempt_row.id,
        attempt_row.student_id,
        profile_row.full_name,
        round(current_average)::integer,
        attempt_row.max_score,
        attempt_row.submitted_at,
        current_rank,
        previous_rank,
        case when previous_rank is null then null else previous_rank - current_rank end,
        current_average,
        current_attempt_count,
        now()
      )
      on conflict (scope, attempt_id) do update set
        score = excluded.score,
        max_score = excluded.max_score,
        rank_snapshot = excluded.rank_snapshot,
        previous_rank_snapshot = excluded.previous_rank_snapshot,
        rank_delta = excluded.rank_delta,
        average_score = excluded.average_score,
        attempt_count = excluded.attempt_count,
        submitted_at = excluded.submitted_at,
        updated_at = now();
    end loop;
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
  questions.created_at,
  questions.question_type,
  questions.correct_marks,
  questions.wrong_marks
from public.questions as questions;

create or replace view public.ranking_entries
with (security_invoker = true)
as
select
  leaderboard_entries.scope,
  leaderboard_entries.attempt_id,
  leaderboard_entries.student_id,
  leaderboard_entries.organization_id,
  leaderboard_entries.organization_name,
  leaderboard_entries.state,
  leaderboard_entries.city,
  leaderboard_entries.full_name,
  leaderboard_entries.exam_slug,
  leaderboard_entries.test_title,
  leaderboard_entries.score,
  leaderboard_entries.max_score,
  leaderboard_entries.submitted_at,
  leaderboard_entries.rank_snapshot::bigint as rank,
  leaderboard_entries.previous_rank_snapshot::bigint as previous_rank,
  leaderboard_entries.rank_delta,
  leaderboard_entries.average_score,
  leaderboard_entries.attempt_count
from public.leaderboard_entries;

create or replace view public.all_india_rankings
with (security_invoker = true)
as
select
  ranking_entries.attempt_id,
  ranking_entries.student_id,
  ranking_entries.full_name,
  ranking_entries.exam_slug,
  ranking_entries.test_title,
  ranking_entries.score,
  ranking_entries.max_score,
  ranking_entries.submitted_at,
  ranking_entries.rank
from public.ranking_entries
where ranking_entries.scope = 'all_india_raw';

create or replace view public.organization_rankings
with (security_invoker = true)
as
select
  ranking_entries.attempt_id,
  ranking_entries.organization_id,
  ranking_entries.organization_name,
  ranking_entries.student_id,
  ranking_entries.full_name,
  ranking_entries.exam_slug,
  ranking_entries.test_title,
  ranking_entries.score,
  ranking_entries.max_score,
  ranking_entries.submitted_at,
  ranking_entries.rank
from public.ranking_entries
where ranking_entries.scope = 'organization_raw';

drop policy if exists "users can read allowed leaderboard entries" on public.leaderboard_entries;
create policy "users can read allowed leaderboard entries"
on public.leaderboard_entries
for select
to authenticated
using (
  scope in (
    'all_india_raw',
    'state_raw',
    'city_raw',
    'all_india_average',
    'state_average',
    'city_average'
  )
  or app_private.is_developer()
  or (
    organization_id is not null
    and app_private.is_org_member(organization_id)
  )
);

grant select on public.practice_questions to authenticated;
grant select on public.ranking_entries to authenticated;
grant select on public.all_india_rankings to authenticated;
grant select on public.organization_rankings to authenticated;

-- Make leaderboards visible to every signed-in user while requiring more than
-- 25 completed attempts for a student to appear in any ranking.

alter table public.tests
  alter column average_rank_min_tests set default 26;

update public.tests
set average_rank_min_tests = 26
where average_rank_min_tests <> 26;

create or replace function public.refresh_leaderboards_for_attempt(attempt_id_input uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  minimum_ranking_attempts integer := 25;
  attempt_row public.test_attempts%rowtype;
  profile_row public.profiles%rowtype;
  exam_row public.exams%rowtype;
  organization_row public.organizations%rowtype;
  scope_name text;
  current_rank integer;
  previous_rank integer;
  current_total_score integer;
  current_total_max_score integer;
  current_average numeric;
  current_attempt_count integer;
  current_latest_attempt_id uuid;
  current_latest_test_id uuid;
  current_latest_attempt_at timestamptz;
  current_organization_id uuid;
  current_organization_name text;
begin
  select * into attempt_row
  from public.test_attempts
  where id = attempt_id_input;

  if attempt_row.id is null then
    raise exception 'attempt not found';
  end if;

  select * into profile_row
  from public.profiles
  where id = attempt_row.student_id;

  select * into exam_row
  from public.exams
  where id = attempt_row.exam_id;

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

    select
      sum(scoped_attempts.score)::integer,
      sum(scoped_attempts.max_score)::integer,
      avg(scoped_attempts.score),
      count(*)::integer,
      (array_agg(scoped_attempts.id order by scoped_attempts.submitted_at desc))[1],
      (array_agg(scoped_attempts.test_id order by scoped_attempts.submitted_at desc))[1],
      max(scoped_attempts.submitted_at),
      case when scope_name = 'organization_raw' then attempt_row.organization_id else null end,
      case when scope_name = 'organization_raw' then organization_row.name else null end
    into
      current_total_score,
      current_total_max_score,
      current_average,
      current_attempt_count,
      current_latest_attempt_id,
      current_latest_test_id,
      current_latest_attempt_at,
      current_organization_id,
      current_organization_name
    from public.test_attempts as scoped_attempts
    where scoped_attempts.student_id = attempt_row.student_id
      and scoped_attempts.exam_id = attempt_row.exam_id
      and (
        scope_name <> 'organization_raw'
        or scoped_attempts.organization_id = attempt_row.organization_id
      );

    if current_attempt_count <= minimum_ranking_attempts then
      delete from public.leaderboard_entries
      where scope = scope_name
        and exam_id = attempt_row.exam_id
        and student_id = attempt_row.student_id;
      continue;
    end if;

    select count(*) + 1 into current_rank
    from (
      select
        ranked_attempts.student_id,
        sum(ranked_attempts.score)::integer as total_score,
        max(ranked_attempts.submitted_at) as latest_attempt_at
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
      group by ranked_attempts.student_id
      having count(*) > minimum_ranking_attempts
    ) as ranked_students
    where ranked_students.student_id <> attempt_row.student_id
      and (
        ranked_students.total_score > current_total_score
        or (
          ranked_students.total_score = current_total_score
          and ranked_students.latest_attempt_at < current_latest_attempt_at
        )
      );

    select leaderboard_entries.rank_snapshot into previous_rank
    from public.leaderboard_entries
    where leaderboard_entries.scope = scope_name
      and leaderboard_entries.exam_id = attempt_row.exam_id
      and leaderboard_entries.student_id = attempt_row.student_id
    order by leaderboard_entries.submitted_at desc
    limit 1;

    delete from public.leaderboard_entries
    where scope = scope_name
      and exam_id = attempt_row.exam_id
      and student_id = attempt_row.student_id;

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
      current_organization_id,
      current_organization_name,
      case when scope_name in ('state_raw', 'city_raw') then profile_row.state else null end,
      case when scope_name = 'city_raw' then profile_row.city else null end,
      current_latest_test_id,
      current_attempt_count::text || ' completed tests',
      current_latest_attempt_id,
      attempt_row.student_id,
      profile_row.full_name,
      current_total_score,
      current_total_max_score,
      current_latest_attempt_at,
      current_rank,
      previous_rank,
      case when previous_rank is null then null else previous_rank - current_rank end,
      current_average,
      current_attempt_count,
      now()
    );
  end loop;

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

    select
      sum(scoped_attempts.score)::integer,
      sum(scoped_attempts.max_score)::integer,
      avg(scoped_attempts.score),
      count(*)::integer,
      (array_agg(scoped_attempts.id order by scoped_attempts.submitted_at desc))[1],
      (array_agg(scoped_attempts.test_id order by scoped_attempts.submitted_at desc))[1],
      max(scoped_attempts.submitted_at),
      case when scope_name = 'organization_average' then attempt_row.organization_id else null end,
      case when scope_name = 'organization_average' then organization_row.name else null end
    into
      current_total_score,
      current_total_max_score,
      current_average,
      current_attempt_count,
      current_latest_attempt_id,
      current_latest_test_id,
      current_latest_attempt_at,
      current_organization_id,
      current_organization_name
    from public.test_attempts as scoped_attempts
    where scoped_attempts.student_id = attempt_row.student_id
      and scoped_attempts.exam_id = attempt_row.exam_id
      and (
        scope_name <> 'organization_average'
        or scoped_attempts.organization_id = attempt_row.organization_id
      );

    if current_attempt_count <= minimum_ranking_attempts then
      delete from public.leaderboard_entries
      where scope = scope_name
        and exam_id = attempt_row.exam_id
        and student_id = attempt_row.student_id;
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
      having count(*) > minimum_ranking_attempts
    ) as ranked_students
    where ranked_students.student_id <> attempt_row.student_id
      and (
        ranked_students.average_score > current_average
        or (
          ranked_students.average_score = current_average
          and ranked_students.latest_attempt_at < current_latest_attempt_at
        )
      );

    select leaderboard_entries.rank_snapshot into previous_rank
    from public.leaderboard_entries
    where leaderboard_entries.scope = scope_name
      and leaderboard_entries.exam_id = attempt_row.exam_id
      and leaderboard_entries.student_id = attempt_row.student_id
    order by leaderboard_entries.submitted_at desc
    limit 1;

    delete from public.leaderboard_entries
    where scope = scope_name
      and exam_id = attempt_row.exam_id
      and student_id = attempt_row.student_id;

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
      current_organization_id,
      current_organization_name,
      case when scope_name in ('state_average', 'city_average') then profile_row.state else null end,
      case when scope_name = 'city_average' then profile_row.city else null end,
      current_latest_test_id,
      current_attempt_count::text || ' completed tests',
      current_latest_attempt_id,
      attempt_row.student_id,
      profile_row.full_name,
      round(current_average)::integer,
      round(current_total_max_score::numeric / current_attempt_count)::integer,
      current_latest_attempt_at,
      current_rank,
      previous_rank,
      case when previous_rank is null then null else previous_rank - current_rank end,
      current_average,
      current_attempt_count,
      now()
    );
  end loop;
end;
$$;

comment on function public.refresh_leaderboards_for_attempt(uuid) is
  'Refreshes aggregate leaderboard rows visible to all users; students appear only after more than 25 attempts.';

truncate table public.leaderboard_entries;

do $$
declare
  latest_attempt record;
begin
  for latest_attempt in
    select distinct on (test_attempts.student_id, test_attempts.exam_id)
      test_attempts.id
    from public.test_attempts as test_attempts
    order by
      test_attempts.student_id,
      test_attempts.exam_id,
      test_attempts.submitted_at desc
  loop
    perform public.refresh_leaderboards_for_attempt(latest_attempt.id);
  end loop;
end;
$$;

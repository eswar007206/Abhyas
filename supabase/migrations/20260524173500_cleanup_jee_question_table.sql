-- Keep Abhyas focused on the shipped JEE flow.
-- This migration replaces the generic questions table with a real JEE-only
-- question table, removes non-JEE placeholder test data, and drops legacy views
-- that are no longer used by the app.

drop view if exists public.all_india_rankings;
drop view if exists public.organization_rankings;
drop view if exists public.practice_questions;
drop view if exists public.jee_questions;

create table public.jee_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  subject text not null,
  topic_name text not null,
  difficulty public.exam_difficulty not null default 'medium',
  created_at timestamptz not null default now(),
  question_type text not null default 'mcq',
  numerical_answer text,
  numerical_tolerance numeric not null default 0,
  correct_marks integer not null default 4,
  wrong_marks integer not null default -1,
  constraint jee_questions_answer_shape_check
    check (
      (
        question_type = 'mcq'
        and correct_option in ('A', 'B', 'C', 'D')
      )
      or (
        question_type = 'numerical'
        and numerical_answer is not null
      )
    )
);

comment on table public.jee_questions is 'JEE-only question bank. NEET and future exams should get their own exam-specific question tables.';

insert into public.jee_questions (
  id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  subject,
  topic_name,
  difficulty,
  created_at,
  question_type,
  numerical_answer,
  numerical_tolerance,
  correct_marks,
  wrong_marks
)
select
  questions.id,
  questions.question_text,
  questions.option_a,
  questions.option_b,
  questions.option_c,
  questions.option_d,
  questions.correct_option,
  questions.subject,
  questions.topic_name,
  questions.difficulty,
  questions.created_at,
  questions.question_type,
  questions.numerical_answer,
  questions.numerical_tolerance,
  questions.correct_marks,
  questions.wrong_marks
from public.questions as questions
join public.exams as exams
  on exams.id = questions.exam_id
where exams.slug = 'jee';

create index jee_questions_subject_idx
  on public.jee_questions (subject);

create index jee_questions_topic_idx
  on public.jee_questions (topic_name);

create index jee_questions_question_type_idx
  on public.jee_questions (question_type);

alter table public.jee_questions enable row level security;

-- Answers live in this table, so students should receive questions only from the
-- backend test-session API, where correct answers are stripped before returning.
revoke all on table public.jee_questions from anon, authenticated;

delete from public.test_questions
where test_id in (
  select tests.id
  from public.tests as tests
  join public.exams as exams
    on exams.id = tests.exam_id
  where exams.slug <> 'jee'
)
or question_id in (
  select questions.id
  from public.questions as questions
  join public.exams as exams
    on exams.id = questions.exam_id
  where exams.slug <> 'jee'
);

delete from public.tests as tests
using public.exams as exams
where tests.exam_id = exams.id
  and exams.slug <> 'jee';

alter table public.test_attempt_answers
  drop constraint if exists test_attempt_answers_question_id_fkey;

alter table public.test_questions
  drop constraint if exists test_questions_question_id_fkey;

alter table public.test_attempt_answers
  add constraint test_attempt_answers_question_id_fkey
  foreign key (question_id)
  references public.jee_questions (id)
  on delete cascade;

alter table public.test_questions
  add constraint test_questions_question_id_fkey
  foreign key (question_id)
  references public.jee_questions (id)
  on delete cascade;

drop table public.questions;

delete from public.exams
where slug <> 'jee';

create or replace view public.ranking_entries
with (security_invoker = true)
as
select
  scope,
  attempt_id,
  student_id,
  organization_id,
  organization_name,
  state,
  city,
  full_name,
  exam_slug,
  test_title,
  score,
  max_score,
  submitted_at,
  rank_snapshot::bigint as rank,
  previous_rank_snapshot::bigint as previous_rank,
  rank_delta,
  average_score,
  attempt_count
from public.leaderboard_entries;

grant select on public.ranking_entries to authenticated;

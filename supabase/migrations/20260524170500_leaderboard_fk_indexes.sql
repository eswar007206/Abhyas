-- Add plain covering indexes for leaderboard foreign keys.

create index if not exists leaderboard_entries_exam_id_idx
  on public.leaderboard_entries (exam_id);

create index if not exists leaderboard_entries_organization_id_idx
  on public.leaderboard_entries (organization_id)
  where organization_id is not null;

create index if not exists leaderboard_entries_test_id_idx
  on public.leaderboard_entries (test_id);

create index if not exists leaderboard_entries_student_id_idx
  on public.leaderboard_entries (student_id);

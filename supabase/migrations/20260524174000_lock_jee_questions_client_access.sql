-- Document and enforce that JEE answer-bearing rows are server-only.

create policy "No direct client access to JEE questions"
on public.jee_questions
for all
to anon, authenticated
using (false)
with check (false);

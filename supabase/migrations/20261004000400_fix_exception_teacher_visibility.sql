-- Phase 4 hardening: exception history remains visible to a teacher who is
-- currently assigned to the occurrence, including after a replacement.

drop policy if exists schedule_exceptions_select_allowed on public.schedule_exceptions;

create policy schedule_exceptions_select_allowed
on public.schedule_exceptions for select to authenticated
using (
  public.is_staff_or_admin()
  or exists (
    select 1
    from public.schedule_occurrences so
    join public.teachers t on t.id = so.teacher_id
    where so.id = schedule_exceptions.occurrence_id
      and t.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.schedule_series ss
    join public.teachers t on t.id = ss.teacher_id
    where ss.id = schedule_exceptions.series_id
      and t.profile_id = auth.uid()
  )
);

-- Schedule write APIs. All schedule mutations are performed through
-- server-side RPCs so conflict detection cannot be bypassed by the client.

create or replace function public.lock_schedule_day(p_day date)
returns void
language sql
as $$
  select pg_advisory_xact_lock(
    hashtextextended('schedule-day:' || p_day::text, 0)
  );
$$;

create or replace function public.create_schedule_occurrence(
  p_series_id uuid,
  p_student_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid,
  p_lesson_date date,
  p_start_time time,
  p_end_time time,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'not authorized';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'end_time must be after start_time';
  end if;

  perform public.lock_schedule_day(p_lesson_date);

  if exists (
    select 1
    from public.schedule_occurrences so
    where so.lesson_date = p_lesson_date
      and so.status in ('SCHEDULED', 'COMPLETED')
      and (so.teacher_id = p_teacher_id or so.student_id = p_student_id)
      and so.start_time < p_end_time
      and p_start_time < so.end_time
  ) then
    raise exception 'schedule conflict for teacher or student';
  end if;

  insert into public.schedule_occurrences (
    series_id,
    student_id,
    teacher_id,
    subject_id,
    lesson_date,
    start_time,
    end_time,
    notes
  )
  values (
    p_series_id,
    p_student_id,
    p_teacher_id,
    p_subject_id,
    p_lesson_date,
    p_start_time,
    p_end_time,
    nullif(trim(p_notes), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_schedule_plan(
  p_student_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid,
  p_lesson_time_id uuid,
  p_recurrence_type public.recurrence_type,
  p_start_date date,
  p_end_date date,
  p_day_of_week smallint default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_id uuid;
  v_date date;
  v_end_date date;
  v_start_time time;
  v_end_time time;
begin
  if not public.is_staff_or_admin() then
    raise exception 'not authorized';
  end if;

  select start_time, end_time
    into v_start_time, v_end_time
  from public.lesson_times
  where id = p_lesson_time_id
    and active = true;

  if v_start_time is null or v_end_time is null then
    raise exception 'active lesson time not found';
  end if;

  if not exists (select 1 from public.students where id = p_student_id and status = 'ACTIVE') then
    raise exception 'active student not found';
  end if;

  if not exists (select 1 from public.teachers where id = p_teacher_id and status = 'ACTIVE') then
    raise exception 'active teacher not found';
  end if;

  if not exists (select 1 from public.subjects where id = p_subject_id and active = true) then
    raise exception 'active subject not found';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'invalid schedule date range';
  end if;

  if p_recurrence_type = 'WEEKLY' and (p_day_of_week is null or p_day_of_week < 0 or p_day_of_week > 6) then
    raise exception 'weekly schedule requires day_of_week between 0 and 6';
  end if;

  if p_recurrence_type = 'ONE_OFF' and p_end_date <> p_start_date then
    raise exception 'one-off schedule must use the same start and end date';
  end if;

  if p_recurrence_type = 'WEEKLY' and p_end_date > (p_start_date + 366) then
    raise exception 'weekly schedule range cannot exceed 366 days';
  end if;

  insert into public.schedule_series (
    student_id,
    teacher_id,
    subject_id,
    lesson_time_id,
    recurrence_type,
    day_of_week,
    start_date,
    end_date,
    status
  )
  values (
    p_student_id,
    p_teacher_id,
    p_subject_id,
    p_lesson_time_id,
    p_recurrence_type,
    case when p_recurrence_type = 'WEEKLY' then p_day_of_week else null end,
    p_start_date,
    p_end_date,
    'ACTIVE'
  )
  returning id into v_series_id;

  if p_recurrence_type = 'ONE_OFF' then
    perform public.create_schedule_occurrence(
      v_series_id,
      p_student_id,
      p_teacher_id,
      p_subject_id,
      p_start_date,
      v_start_time,
      v_end_time,
      p_notes
    );
  else
    v_date := p_start_date;
    v_end_date := p_end_date;

    while v_date <= v_end_date loop
      if extract(dow from v_date)::smallint = p_day_of_week then
        perform public.create_schedule_occurrence(
          v_series_id,
          p_student_id,
          p_teacher_id,
          p_subject_id,
          v_date,
          v_start_time,
          v_end_time,
          p_notes
        );
      end if;
      v_date := v_date + 1;
    end loop;
  end if;

  return v_series_id;
exception
  when others then
    if v_series_id is not null then
      delete from public.schedule_series where id = v_series_id;
    end if;
    raise;
end;
$$;

create or replace function public.update_schedule_occurrence(
  p_occurrence_id uuid,
  p_lesson_date date,
  p_start_time time,
  p_end_time time,
  p_status public.schedule_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.schedule_occurrences%rowtype;
  v_min_date date;
  v_max_date date;
begin
  if not public.is_staff_or_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_existing
  from public.schedule_occurrences
  where id = p_occurrence_id
  for update;

  if not found then
    raise exception 'schedule occurrence not found';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'end_time must be after start_time';
  end if;

  v_min_date := least(v_existing.lesson_date, p_lesson_date);
  v_max_date := greatest(v_existing.lesson_date, p_lesson_date);

  perform public.lock_schedule_day(v_min_date);
  if v_max_date <> v_min_date then
    perform public.lock_schedule_day(v_max_date);
  end if;

  if exists (
    select 1
    from public.schedule_occurrences so
    where so.id <> p_occurrence_id
      and so.lesson_date = p_lesson_date
      and so.status in ('SCHEDULED', 'COMPLETED')
      and (so.teacher_id = v_existing.teacher_id or so.student_id = v_existing.student_id)
      and so.start_time < p_end_time
      and p_start_time < so.end_time
  ) then
    raise exception 'schedule conflict for teacher or student';
  end if;

  update public.schedule_occurrences
  set lesson_date = p_lesson_date,
      start_time = p_start_time,
      end_time = p_end_time,
      status = p_status,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      updated_at = now()
  where id = p_occurrence_id;
end;
$$;

create or replace function public.delete_schedule_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select lesson_date into v_date
  from public.schedule_occurrences
  where id = p_occurrence_id;

  if v_date is null then
    raise exception 'schedule occurrence not found';
  end if;

  perform public.lock_schedule_day(v_date);
  delete from public.schedule_occurrences where id = p_occurrence_id;
end;
$$;

revoke all on function public.lock_schedule_day(date) from public;
revoke all on function public.create_schedule_occurrence(uuid, uuid, uuid, uuid, date, time, time, text) from public;
revoke all on function public.create_schedule_plan(uuid, uuid, uuid, uuid, public.recurrence_type, date, date, smallint, text) from public;
revoke all on function public.update_schedule_occurrence(uuid, date, time, time, public.schedule_status, text) from public;
revoke all on function public.delete_schedule_occurrence(uuid) from public;

grant execute on function public.create_schedule_plan(uuid, uuid, uuid, uuid, public.recurrence_type, date, date, smallint, text) to authenticated;
grant execute on function public.update_schedule_occurrence(uuid, date, time, time, public.schedule_status, text) to authenticated;
grant execute on function public.delete_schedule_occurrence(uuid) to authenticated;


-- Tighten teacher status permissions from the initial schema.
create or replace function public.update_lesson_status(
  p_occurrence_id uuid,
  p_status public.schedule_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_profile uuid;
begin
  select t.profile_id
    into v_teacher_profile
  from public.schedule_occurrences so
  join public.teachers t on t.id = so.teacher_id
  where so.id = p_occurrence_id;

  if public.is_staff_or_admin() then
    update public.schedule_occurrences
    set status = p_status,
        notes = coalesce(nullif(trim(p_notes), ''), notes),
        updated_at = now()
    where id = p_occurrence_id;
    return;
  end if;

  if public.is_teacher() and v_teacher_profile = auth.uid() then
    if p_status not in ('SCHEDULED', 'COMPLETED', 'NO_SHOW') then
      raise exception 'teacher cannot set this lesson status';
    end if;

    update public.schedule_occurrences
    set status = p_status,
        notes = coalesce(nullif(trim(p_notes), ''), notes),
        updated_at = now()
    where id = p_occurrence_id;
    return;
  end if;

  raise exception 'not authorized';
end;
$$;

revoke all on function public.update_lesson_status(uuid, public.schedule_status, text) from public;
grant execute on function public.update_lesson_status(uuid, public.schedule_status, text) to authenticated;

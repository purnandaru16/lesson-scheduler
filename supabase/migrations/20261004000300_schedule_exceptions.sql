-- Schedule exception engine.
-- Keeps the recurring series intact while recording one-off operational changes.

alter table public.schedule_exceptions
  alter column series_id drop not null;

alter table public.schedule_exceptions
  add column if not exists occurrence_id uuid references public.schedule_occurrences(id) on delete cascade,
  add column if not exists original_teacher_id uuid references public.teachers(id) on delete set null,
  add column if not exists replacement_teacher_id uuid references public.teachers(id) on delete set null,
  add column if not exists replacement_occurrence_id uuid references public.schedule_occurrences(id) on delete set null;

create index if not exists idx_exceptions_occurrence
  on public.schedule_exceptions(occurrence_id, created_at desc);

create or replace function public.cancel_schedule_occurrence(
  p_occurrence_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.schedule_occurrences%rowtype;
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

  if v_existing.status = 'COMPLETED' then
    raise exception 'completed lesson cannot be cancelled';
  end if;

  perform public.lock_schedule_day(v_existing.lesson_date);

  update public.schedule_occurrences
  set status = 'CANCELLED',
      notes = coalesce(nullif(trim(p_reason), ''), notes),
      updated_at = now()
  where id = p_occurrence_id;

  insert into public.schedule_exceptions (
    series_id,
    occurrence_id,
    original_date,
    type,
    reason
  )
  values (
    v_existing.series_id,
    v_existing.id,
    v_existing.lesson_date,
    'CANCELLED',
    nullif(trim(p_reason), '')
  );

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    'SCHEDULE_OCCURRENCE',
    v_existing.id::text,
    'CANCELLED',
    to_jsonb(v_existing),
    to_jsonb(v_existing) || jsonb_build_object('status', 'CANCELLED')
  );
end;
$$;

create or replace function public.reschedule_schedule_occurrence(
  p_occurrence_id uuid,
  p_new_date date,
  p_new_start_time time,
  p_new_end_time time,
  p_reason text default null
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

  if v_existing.status = 'COMPLETED' then
    raise exception 'completed lesson cannot be rescheduled';
  end if;

  if p_new_date is null or p_new_start_time is null or p_new_end_time is null or p_new_end_time <= p_new_start_time then
    raise exception 'invalid replacement date or time';
  end if;

  v_min_date := least(v_existing.lesson_date, p_new_date);
  v_max_date := greatest(v_existing.lesson_date, p_new_date);

  perform public.lock_schedule_day(v_min_date);
  if v_max_date <> v_min_date then
    perform public.lock_schedule_day(v_max_date);
  end if;

  if exists (
    select 1
    from public.schedule_occurrences so
    where so.id <> v_existing.id
      and so.lesson_date = p_new_date
      and so.status in ('SCHEDULED', 'COMPLETED')
      and (so.teacher_id = v_existing.teacher_id or so.student_id = v_existing.student_id)
      and so.start_time < p_new_end_time
      and p_new_start_time < so.end_time
  ) then
    raise exception 'schedule conflict for teacher or student';
  end if;

  update public.schedule_occurrences
  set lesson_date = p_new_date,
      start_time = p_new_start_time,
      end_time = p_new_end_time,
      status = 'SCHEDULED',
      updated_at = now()
  where id = v_existing.id;

  insert into public.schedule_exceptions (
    series_id,
    occurrence_id,
    original_date,
    type,
    replacement_date,
    replacement_start,
    replacement_end,
    reason
  )
  values (
    v_existing.series_id,
    v_existing.id,
    v_existing.lesson_date,
    'RESCHEDULED',
    p_new_date,
    p_new_start_time,
    p_new_end_time,
    nullif(trim(p_reason), '')
  );

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    'SCHEDULE_OCCURRENCE',
    v_existing.id::text,
    'RESCHEDULED',
    to_jsonb(v_existing),
    jsonb_build_object(
      'id', v_existing.id,
      'lesson_date', p_new_date,
      'start_time', p_new_start_time,
      'end_time', p_new_end_time,
      'status', 'SCHEDULED'
    )
  );
end;
$$;

create or replace function public.replace_schedule_teacher(
  p_occurrence_id uuid,
  p_new_teacher_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.schedule_occurrences%rowtype;
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

  if v_existing.status = 'COMPLETED' then
    raise exception 'completed lesson cannot change teacher';
  end if;

  if p_new_teacher_id = v_existing.teacher_id then
    raise exception 'replacement teacher must be different';
  end if;

  if not exists (
    select 1 from public.teachers
    where id = p_new_teacher_id and status = 'ACTIVE'
  ) then
    raise exception 'active replacement teacher not found';
  end if;

  perform public.lock_schedule_day(v_existing.lesson_date);
  perform pg_advisory_xact_lock(
    hashtextextended('teacher:' || p_new_teacher_id::text || ':' || v_existing.lesson_date::text, 0)
  );

  if exists (
    select 1
    from public.schedule_occurrences so
    where so.id <> v_existing.id
      and so.lesson_date = v_existing.lesson_date
      and so.status in ('SCHEDULED', 'COMPLETED')
      and so.teacher_id = p_new_teacher_id
      and so.start_time < v_existing.end_time
      and v_existing.start_time < so.end_time
  ) then
    raise exception 'schedule conflict for replacement teacher';
  end if;

  update public.schedule_occurrences
  set teacher_id = p_new_teacher_id,
      updated_at = now()
  where id = v_existing.id;

  insert into public.schedule_exceptions (
    series_id,
    occurrence_id,
    original_date,
    type,
    original_teacher_id,
    replacement_teacher_id,
    reason
  )
  values (
    v_existing.series_id,
    v_existing.id,
    v_existing.lesson_date,
    'REPLACEMENT',
    v_existing.teacher_id,
    p_new_teacher_id,
    nullif(trim(p_reason), '')
  );

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    'SCHEDULE_OCCURRENCE',
    v_existing.id::text,
    'TEACHER_REPLACED',
    jsonb_build_object('teacher_id', v_existing.teacher_id),
    jsonb_build_object('teacher_id', p_new_teacher_id)
  );
end;
$$;

create or replace function public.create_makeup_schedule_occurrence(
  p_occurrence_id uuid,
  p_new_date date,
  p_new_start_time time,
  p_new_end_time time,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.schedule_occurrences%rowtype;
  v_new_id uuid;
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

  if v_existing.status = 'COMPLETED' then
    raise exception 'completed lesson cannot have a makeup';
  end if;

  if p_new_date is null or p_new_start_time is null or p_new_end_time is null or p_new_end_time <= p_new_start_time then
    raise exception 'invalid makeup date or time';
  end if;

  perform public.lock_schedule_day(p_new_date);
  perform pg_advisory_xact_lock(
    hashtextextended('teacher:' || v_existing.teacher_id::text || ':' || p_new_date::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('student:' || v_existing.student_id::text || ':' || p_new_date::text, 0)
  );

  if exists (
    select 1
    from public.schedule_occurrences so
    where so.lesson_date = p_new_date
      and so.status in ('SCHEDULED', 'COMPLETED')
      and (so.teacher_id = v_existing.teacher_id or so.student_id = v_existing.student_id)
      and so.start_time < p_new_end_time
      and p_new_start_time < so.end_time
  ) then
    raise exception 'schedule conflict for teacher or student';
  end if;

  if v_existing.status = 'SCHEDULED' then
    update public.schedule_occurrences
    set status = 'CANCELLED', updated_at = now()
    where id = v_existing.id;
  end if;

  insert into public.schedule_occurrences (
    series_id,
    student_id,
    teacher_id,
    subject_id,
    lesson_date,
    start_time,
    end_time,
    status,
    notes
  )
  values (
    v_existing.series_id,
    v_existing.student_id,
    v_existing.teacher_id,
    v_existing.subject_id,
    p_new_date,
    p_new_start_time,
    p_new_end_time,
    'SCHEDULED',
    nullif(trim(p_reason), '')
  )
  returning id into v_new_id;

  insert into public.schedule_exceptions (
    series_id,
    occurrence_id,
    replacement_occurrence_id,
    original_date,
    type,
    replacement_date,
    replacement_start,
    replacement_end,
    reason
  )
  values (
    v_existing.series_id,
    v_existing.id,
    v_new_id,
    v_existing.lesson_date,
    'MAKEUP',
    p_new_date,
    p_new_start_time,
    p_new_end_time,
    nullif(trim(p_reason), '')
  );

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    'SCHEDULE_OCCURRENCE',
    v_existing.id::text,
    'MAKEUP_CREATED',
    jsonb_build_object('status', v_existing.status, 'lesson_date', v_existing.lesson_date),
    jsonb_build_object('replacement_occurrence_id', v_new_id, 'lesson_date', p_new_date)
  );

  return v_new_id;
end;
$$;

revoke all on function public.cancel_schedule_occurrence(uuid, text) from public;
revoke all on function public.reschedule_schedule_occurrence(uuid, date, time, time, text) from public;
revoke all on function public.replace_schedule_teacher(uuid, uuid, text) from public;
revoke all on function public.create_makeup_schedule_occurrence(uuid, date, time, time, text) from public;

grant execute on function public.cancel_schedule_occurrence(uuid, text) to authenticated;
grant execute on function public.reschedule_schedule_occurrence(uuid, date, time, time, text) to authenticated;
grant execute on function public.replace_schedule_teacher(uuid, uuid, text) to authenticated;
grant execute on function public.create_makeup_schedule_occurrence(uuid, date, time, time, text) to authenticated;

-- Extend the existing generic staff update so ordinary date/time edits also leave
-- an exception trail. Dedicated exception RPCs remain preferred for explicit actions.
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

  if v_existing.status = 'COMPLETED'
     and (p_lesson_date <> v_existing.lesson_date
       or p_start_time <> v_existing.start_time
       or p_end_time <> v_existing.end_time
       or p_status <> v_existing.status) then
    raise exception 'completed lesson timing or status cannot be changed';
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

  if p_lesson_date <> v_existing.lesson_date
     or p_start_time <> v_existing.start_time
     or p_end_time <> v_existing.end_time then
    insert into public.schedule_exceptions (
      series_id,
      occurrence_id,
      original_date,
      type,
      replacement_date,
      replacement_start,
      replacement_end,
      reason
    )
    values (
      v_existing.series_id,
      v_existing.id,
      v_existing.lesson_date,
      'RESCHEDULED',
      p_lesson_date,
      p_start_time,
      p_end_time,
      nullif(trim(p_notes), '')
    );
  end if;

  if p_status = 'CANCELLED' and v_existing.status <> 'CANCELLED' then
    insert into public.schedule_exceptions (
      series_id,
      occurrence_id,
      original_date,
      type,
      reason
    )
    values (
      v_existing.series_id,
      v_existing.id,
      p_lesson_date,
      'CANCELLED',
      nullif(trim(p_notes), '')
    );
  end if;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    'SCHEDULE_OCCURRENCE',
    v_existing.id::text,
    'UPDATED',
    to_jsonb(v_existing),
    jsonb_build_object(
      'lesson_date', p_lesson_date,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'status', p_status,
      'notes', nullif(trim(coalesce(p_notes, '')), '')
    )
  );
end;
$$;

revoke all on function public.update_schedule_occurrence(uuid, date, time, time, public.schedule_status, text) from public;
grant execute on function public.update_schedule_occurrence(uuid, date, time, time, public.schedule_status, text) to authenticated;

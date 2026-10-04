-- Lesson Scheduler initial schema
-- Security model: all application tables are protected by RLS.

create extension if not exists pgcrypto;

create type public.app_role as enum ('ADMIN', 'STAFF', 'TEACHER');
create type public.record_status as enum ('ACTIVE', 'INACTIVE');
create type public.recurrence_type as enum ('WEEKLY', 'ONE_OFF');
create type public.schedule_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
create type public.exception_type as enum ('CANCELLED', 'RESCHEDULED', 'REPLACEMENT', 'SKIPPED');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'STAFF',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  email text,
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  birth_date date,
  address text,
  status public.record_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_times (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  duration_min integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_times_valid_range check (end_time > start_time),
  constraint lesson_times_duration_positive check (duration_min > 0),
  constraint lesson_times_unique_slot unique (name, start_time, end_time)
);

create table public.schedule_series (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  lesson_time_id uuid references public.lesson_times(id) on delete restrict,
  recurrence_type public.recurrence_type not null,
  day_of_week smallint,
  start_date date not null,
  end_date date,
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_series_day_of_week_range check (day_of_week is null or day_of_week between 0 and 6),
  constraint schedule_series_date_range check (end_date is null or end_date >= start_date),
  constraint schedule_series_weekly_requires_day check (
    recurrence_type = 'ONE_OFF' or day_of_week is not null
  )
);

create table public.schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.schedule_series(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  lesson_date date not null,
  start_time time not null,
  end_time time not null,
  status public.schedule_status not null default 'SCHEDULED',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_occurrences_valid_range check (end_time > start_time)
);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.schedule_series(id) on delete cascade,
  original_date date not null,
  type public.exception_type not null,
  replacement_date date,
  replacement_start time,
  replacement_end time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_exceptions_replacement_range check (
    replacement_start is null or replacement_end is null or replacement_end > replacement_start
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_teachers_profile_id on public.teachers(profile_id);
create index idx_students_status_name on public.students(status, name);
create index idx_lesson_times_active_start on public.lesson_times(active, start_time);
create index idx_series_student on public.schedule_series(student_id);
create index idx_series_teacher on public.schedule_series(teacher_id);
create index idx_series_status_dates on public.schedule_series(status, start_date, end_date);
create index idx_occurrences_date on public.schedule_occurrences(lesson_date);
create index idx_occurrences_teacher_date on public.schedule_occurrences(teacher_id, lesson_date);
create index idx_occurrences_student_date on public.schedule_occurrences(student_id, lesson_date);
create index idx_occurrences_subject_date on public.schedule_occurrences(subject_id, lesson_date);
create index idx_exceptions_series_date on public.schedule_exceptions(series_id, original_date);
create index idx_audit_actor_created on public.audit_logs(actor_user_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger teachers_set_updated_at before update on public.teachers
for each row execute function public.set_updated_at();
create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects
for each row execute function public.set_updated_at();
create trigger lesson_times_set_updated_at before update on public.lesson_times
for each row execute function public.set_updated_at();
create trigger schedule_series_set_updated_at before update on public.schedule_series
for each row execute function public.set_updated_at();
create trigger schedule_occurrences_set_updated_at before update on public.schedule_occurrences
for each row execute function public.set_updated_at();
create trigger schedule_exceptions_set_updated_at before update on public.schedule_exceptions
for each row execute function public.set_updated_at();

-- New auth users receive a basic profile. The default role is STAFF so that
-- an account cannot self-promote simply by sending user metadata during signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- These helpers are SECURITY DEFINER to avoid recursive RLS checks when
-- policies need to inspect the caller's profile.
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'ADMIN', false);
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('ADMIN', 'STAFF'), false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'TEACHER', false);
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.lesson_times enable row level security;
alter table public.schedule_series enable row level security;
alter table public.schedule_occurrences enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin_only
on public.profiles for delete to authenticated
using (public.is_admin());

-- Teachers
create policy teachers_select_allowed
on public.teachers for select to authenticated
using (
  public.is_staff_or_admin()
  or profile_id = auth.uid()
);

create policy teachers_insert_staff
on public.teachers for insert to authenticated
with check (public.is_staff_or_admin());

create policy teachers_update_staff
on public.teachers for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy teachers_delete_admin
on public.teachers for delete to authenticated
using (public.is_admin());

-- Students
create policy students_select_allowed
on public.students for select to authenticated
using (
  public.is_staff_or_admin()
  or exists (
    select 1
    from public.schedule_series ss
    join public.teachers t on t.id = ss.teacher_id
    where ss.student_id = students.id
      and t.profile_id = auth.uid()
      and ss.status = 'ACTIVE'
  )
);

create policy students_insert_staff
on public.students for insert to authenticated
with check (public.is_staff_or_admin());

create policy students_update_staff
on public.students for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy students_delete_admin
on public.students for delete to authenticated
using (public.is_admin());

-- Subjects and lesson times are reference data. Any authenticated active
-- user may read them; write access stays with staff/admin.
create policy subjects_select_authenticated
on public.subjects for select to authenticated
using (active or public.is_staff_or_admin());

create policy subjects_insert_staff
on public.subjects for insert to authenticated
with check (public.is_staff_or_admin());

create policy subjects_update_staff
on public.subjects for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy subjects_delete_admin
on public.subjects for delete to authenticated
using (public.is_admin());

create policy lesson_times_select_authenticated
on public.lesson_times for select to authenticated
using (active or public.is_staff_or_admin());

create policy lesson_times_insert_staff
on public.lesson_times for insert to authenticated
with check (public.is_staff_or_admin());

create policy lesson_times_update_staff
on public.lesson_times for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy lesson_times_delete_admin
on public.lesson_times for delete to authenticated
using (public.is_admin());

-- Schedule series: teachers can inspect their own assigned series, but
-- management changes remain staff/admin operations.
create policy schedule_series_select_allowed
on public.schedule_series for select to authenticated
using (
  public.is_staff_or_admin()
  or exists (
    select 1
    from public.teachers t
    where t.id = schedule_series.teacher_id
      and t.profile_id = auth.uid()
  )
);

create policy schedule_series_insert_staff
on public.schedule_series for insert to authenticated
with check (public.is_staff_or_admin());

create policy schedule_series_update_staff
on public.schedule_series for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy schedule_series_delete_staff
on public.schedule_series for delete to authenticated
using (public.is_staff_or_admin());

-- Occurrences: teachers can view their own and change status through the RPC
-- below. General table UPDATE is intentionally omitted for TEACHER.
create policy schedule_occurrences_select_allowed
on public.schedule_occurrences for select to authenticated
using (
  public.is_staff_or_admin()
  or exists (
    select 1
    from public.teachers t
    where t.id = schedule_occurrences.teacher_id
      and t.profile_id = auth.uid()
  )
);

create policy schedule_occurrences_insert_staff
on public.schedule_occurrences for insert to authenticated
with check (public.is_staff_or_admin());

create policy schedule_occurrences_update_staff
on public.schedule_occurrences for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy schedule_occurrences_delete_staff
on public.schedule_occurrences for delete to authenticated
using (public.is_staff_or_admin());

-- Exceptions are operational schedule changes and are staff/admin managed.
create policy schedule_exceptions_select_allowed
on public.schedule_exceptions for select to authenticated
using (
  public.is_staff_or_admin()
  or exists (
    select 1
    from public.schedule_series ss
    join public.teachers t on t.id = ss.teacher_id
    where ss.id = schedule_exceptions.series_id
      and t.profile_id = auth.uid()
  )
);

create policy schedule_exceptions_insert_staff
on public.schedule_exceptions for insert to authenticated
with check (public.is_staff_or_admin());

create policy schedule_exceptions_update_staff
on public.schedule_exceptions for update to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy schedule_exceptions_delete_staff
on public.schedule_exceptions for delete to authenticated
using (public.is_staff_or_admin());

-- Audit log is append-only for application users and readable by admin only.
create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (public.is_admin());

create policy audit_logs_insert_authenticated
on public.audit_logs for insert to authenticated
with check (actor_user_id = auth.uid());

-- Conflict-safe schedule creation. Lock teacher/day and student/day keys so
-- concurrent clients cannot race through the overlap check.
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

  perform pg_advisory_xact_lock(
    hashtextextended('teacher:' || p_teacher_id::text || ':' || p_lesson_date::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('student:' || p_student_id::text || ':' || p_lesson_date::text, 0)
  );

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
    p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Teachers can update only operational lesson state, not schedule ownership or timing.
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
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_occurrence_id;
    return;
  end if;

  if public.is_teacher() and v_teacher_profile = auth.uid() then
    update public.schedule_occurrences
    set status = p_status,
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_occurrence_id;
    return;
  end if;

  raise exception 'not authorized';
end;
$$;

-- Least-privilege API grants. RLS remains the row-level boundary.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.teachers to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.lesson_times to authenticated;
grant select, insert, update, delete on public.schedule_series to authenticated;
grant select on public.schedule_occurrences to authenticated;
grant select, insert, update, delete on public.schedule_exceptions to authenticated;
grant select, insert on public.audit_logs to authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.create_schedule_occurrence(uuid, uuid, uuid, uuid, date, time, time, text) to authenticated;
grant execute on function public.update_lesson_status(uuid, public.schedule_status, text) to authenticated;

-- Useful seed/reference data. Safe to re-run.
insert into public.subjects (name) values
  ('Mathematics'),
  ('English'),
  ('Physics')
on conflict (name) do nothing;

insert into public.lesson_times (name, start_time, end_time, duration_min) values
  ('Morning 1', '08:00', '09:00', 60),
  ('Morning 2', '09:00', '10:00', 60),
  ('Afternoon 1', '14:00', '15:00', 60),
  ('Evening 1', '19:00', '20:00', 60),
  ('Evening 2', '20:00', '21:00', 60)
on conflict do nothing;

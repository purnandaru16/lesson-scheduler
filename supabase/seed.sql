-- Development-only seed data.
-- This file intentionally does not contain credentials or production data.
-- Supabase applies this file after all migrations during `supabase start`
-- and `supabase db reset`.

insert into public.subjects (name, active)
values
  ('Mathematics', true),
  ('English', true),
  ('Physics', true),
  ('Chemistry', true)
on conflict (name) do update
set active = excluded.active;

insert into public.lesson_times (name, start_time, end_time, duration_min, active)
values
  ('Morning 1', '08:00', '09:00', 60, true),
  ('Morning 2', '09:00', '10:00', 60, true),
  ('Afternoon 1', '14:00', '15:00', 60, true),
  ('Evening 1', '19:00', '20:00', 60, true),
  ('Evening 2', '20:00', '21:00', 60, true)
on conflict (name, start_time, end_time) do update
set duration_min = excluded.duration_min,
    active = excluded.active;

insert into public.students (id, name, phone, email, status, notes)
values
  ('10000000-0000-4000-8000-000000000001', 'Budi Santoso', '081234567890', 'budi@example.test', 'ACTIVE', 'Seed student'),
  ('10000000-0000-4000-8000-000000000002', 'Sinta Wijaya', '081234567891', 'sinta@example.test', 'ACTIVE', 'Seed student')
on conflict (id) do update
set name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    status = excluded.status,
    notes = excluded.notes;

insert into public.teachers (id, name, phone, email, status)
values
  ('20000000-0000-4000-8000-000000000001', 'Pak Andi', '082111111111', 'andi@example.test', 'ACTIVE'),
  ('20000000-0000-4000-8000-000000000002', 'Bu Rina', '082111111112', 'rina@example.test', 'ACTIVE')
on conflict (id) do update
set name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    status = excluded.status;

-- A small set of calendar data so the application is useful immediately after reset.
-- It deliberately uses the current date plus offsets so the sample remains visible
-- regardless of when a developer resets the local database.
do $$
declare
  v_math uuid;
  v_english uuid;
  v_evening1 uuid;
  v_evening2 uuid;
  v_series uuid;
  v_date date;
  v_day smallint;
begin
  select id into v_math from public.subjects where name = 'Mathematics';
  select id into v_english from public.subjects where name = 'English';
  select id into v_evening1 from public.lesson_times where name = 'Evening 1';
  select id into v_evening2 from public.lesson_times where name = 'Evening 2';

  insert into public.schedule_series (
    id,
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
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    v_math,
    v_evening1,
    'WEEKLY',
    extract(dow from current_date)::smallint,
    current_date,
    current_date + 35,
    'ACTIVE'
  )
  on conflict (id) do nothing;

  v_series := '30000000-0000-4000-8000-000000000001';
  v_date := current_date;
  v_day := extract(dow from current_date)::smallint;

  while v_date <= current_date + 35 loop
    if extract(dow from v_date)::smallint = v_day then
      insert into public.schedule_occurrences (
        series_id, student_id, teacher_id, subject_id, lesson_date, start_time, end_time, status, notes
      )
      values (
        v_series,
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        v_math,
        v_date,
        '19:00',
        '20:00',
        'SCHEDULED',
        'Seed weekly mathematics lesson'
      )
      on conflict do nothing;
    end if;
    v_date := v_date + 1;
  end loop;

  insert into public.schedule_series (
    id,
    student_id,
    teacher_id,
    subject_id,
    lesson_time_id,
    recurrence_type,
    start_date,
    status
  )
  values (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    v_english,
    v_evening2,
    'ONE_OFF',
    current_date + 2,
    'ACTIVE'
  )
  on conflict (id) do nothing;

  insert into public.schedule_occurrences (
    series_id, student_id, teacher_id, subject_id, lesson_date, start_time, end_time, status, notes
  )
  values (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    v_english,
    current_date + 2,
    '20:00',
    '21:00',
    'SCHEDULED',
    'Seed one-off English lesson'
  )
  on conflict do nothing;
end $$;

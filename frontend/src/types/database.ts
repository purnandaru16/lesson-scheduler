export type AppRole = 'ADMIN' | 'STAFF' | 'TEACHER'
export type RecordStatus = 'ACTIVE' | 'INACTIVE'
export type RecurrenceType = 'WEEKLY' | 'ONE_OFF'
export type ScheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type ExceptionType = 'CANCELLED' | 'RESCHEDULED' | 'REPLACEMENT' | 'SKIPPED' | 'MAKEUP'

export interface Profile {
  id: string
  full_name: string
  role: AppRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  profile_id: string | null
  name: string
  phone: string | null
  email: string | null
  status: RecordStatus
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  address: string | null
  status: RecordStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  name: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface LessonTime {
  id: string
  name: string
  start_time: string
  end_time: string
  duration_min: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface ScheduleSeries {
  id: string
  student_id: string
  teacher_id: string
  subject_id: string
  lesson_time_id: string | null
  recurrence_type: RecurrenceType
  day_of_week: number | null
  start_date: string
  end_date: string | null
  status: RecordStatus
  created_at: string
  updated_at: string
}


export interface ScheduleException {
  id: string
  series_id: string | null
  occurrence_id: string | null
  replacement_occurrence_id: string | null
  original_date: string
  type: ExceptionType
  replacement_date: string | null
  replacement_start: string | null
  replacement_end: string | null
  original_teacher_id: string | null
  replacement_teacher_id: string | null
  reason: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleOccurrence {
  id: string
  series_id: string | null
  student_id: string
  teacher_id: string
  subject_id: string
  lesson_date: string
  start_time: string
  end_time: string
  status: ScheduleStatus
  notes: string | null
  created_at: string
  updated_at: string
  student?: Pick<Student, 'name'> | null
  teacher?: Pick<Teacher, 'name'> | null
  subject?: Pick<Subject, 'name'> | null
}

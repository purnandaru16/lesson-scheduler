import 'temporal-polyfill/global'
import 'temporal-polyfill/types/global'
import '@fullcalendar/react/skeleton.css'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import listPlugin from '@fullcalendar/react/list'
import interactionPlugin from '@fullcalendar/react/interaction'
import { CalendarPlus, CalendarClock, CheckCircle2, Filter, Plus, RefreshCw, Search, ShieldAlert, Trash2, UserRoundCog, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Card, Input, PageHeader, Select } from '@/components/ui'
import { useAuth } from '@/features/auth/auth'
import { addDays, formatDate, formatTime, toLocalDateInput, toLocalTimeInput } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import type { LessonTime, ScheduleException, ScheduleOccurrence, ScheduleStatus, Student, Subject, Teacher } from '@/types/database'

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const createSchema = z.object({
  student_id: z.string().uuid('Student is required'),
  teacher_id: z.string().uuid('Teacher is required'),
  subject_id: z.string().uuid('Subject is required'),
  lesson_time_id: z.string().uuid('Lesson time is required'),
  recurrence_type: z.enum(['ONE_OFF', 'WEEKLY']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  day_of_week: z.string(),
  notes: z.string().max(1000).optional(),
})
type CreateData = z.infer<typeof createSchema>

const updateSchema = z.object({
  lesson_date: z.string().min(1, 'Date is required'),
  lesson_time_id: z.string().uuid('Lesson time is required'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().max(1000).optional(),
})
type UpdateData = z.infer<typeof updateSchema>

async function fetchReferenceData() {
  const [studentsResult, teachersResult, subjectsResult, lessonTimesResult] = await Promise.all([
    supabase.from('students').select('*').eq('status', 'ACTIVE').order('name').returns<Student[]>(),
    supabase.from('teachers').select('*').eq('status', 'ACTIVE').order('name').returns<Teacher[]>(),
    supabase.from('subjects').select('*').eq('active', true).order('name').returns<Subject[]>(),
    supabase.from('lesson_times').select('*').eq('active', true).order('start_time').returns<LessonTime[]>(),
  ])

  for (const result of [studentsResult, teachersResult, subjectsResult, lessonTimesResult]) {
    if (result.error) throw result.error
  }

  return {
    students: studentsResult.data ?? [],
    teachers: teachersResult.data ?? [],
    subjects: subjectsResult.data ?? [],
    lessonTimes: lessonTimesResult.data ?? [],
  }
}

async function fetchOccurrences(start: string, end: string): Promise<ScheduleOccurrence[]> {
  const { data, error } = await supabase
    .from('schedule_occurrences')
    .select('*,student:students(name),teacher:teachers(name),subject:subjects(name)')
    .gte('lesson_date', start)
    .lt('lesson_date', end)
    .order('lesson_date')
    .order('start_time')
    .returns<ScheduleOccurrence[]>()
  if (error) throw error
  return data ?? []
}

function getQueryRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7)
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 42)
  return { start: toLocalDateInput(start), end: toLocalDateInput(end) }
}

function ScheduleForm({ refs, onClose, onCreated, initialDate }: { refs: Awaited<ReturnType<typeof fetchReferenceData>>; onClose: () => void; onCreated: () => void; initialDate?: string }) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const startDate = initialDate ?? toLocalDateInput()
  const { register, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      student_id: refs.students[0]?.id ?? '',
      teacher_id: refs.teachers[0]?.id ?? '',
      subject_id: refs.subjects[0]?.id ?? '',
      lesson_time_id: refs.lessonTimes[0]?.id ?? '',
      recurrence_type: 'ONE_OFF',
      start_date: startDate,
      end_date: startDate,
      day_of_week: String(new Date().getDay()),
      notes: '',
    },
  })
  const recurrenceType = watch('recurrence_type')

  async function onSubmit(values: CreateData) {
    setSaveError(null)
    try {
      const { error } = await supabase.rpc('create_schedule_plan', {
        p_student_id: values.student_id,
        p_teacher_id: values.teacher_id,
        p_subject_id: values.subject_id,
        p_lesson_time_id: values.lesson_time_id,
        p_recurrence_type: values.recurrence_type,
        p_start_date: values.start_date,
        p_end_date: values.recurrence_type === 'ONE_OFF' ? values.start_date : values.end_date,
        p_day_of_week: values.recurrence_type === 'WEEKLY' ? Number(values.day_of_week) : null,
        p_notes: values.notes?.trim() || null,
      })
      if (error) throw error
      onCreated()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to create schedule')
    }
  }

  return (
    <Card className="mb-5 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">New schedule</h2>
          <p className="mt-1 text-xs text-slate-500">Weekly schedules are materialized into occurrences for the selected date range.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
      </div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <Field label="Student" error={errors.student_id?.message}>
          <Select {...register('student_id')}>
            {refs.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Teacher" error={errors.teacher_id?.message}>
          <Select {...register('teacher_id')}>
            {refs.teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Subject" error={errors.subject_id?.message}>
          <Select {...register('subject_id')}>
            {refs.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Lesson time" error={errors.lesson_time_id?.message}>
          <Select {...register('lesson_time_id')}>
            {refs.lessonTimes.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatTime(item.start_time)} - {formatTime(item.end_time)}</option>)}
          </Select>
        </Field>
        <Field label="Schedule type">
          <Select {...register('recurrence_type')}>
            <option value="ONE_OFF">One-off</option>
            <option value="WEEKLY">Weekly</option>
          </Select>
        </Field>
        <Field label="Start date" error={errors.start_date?.message}>
          <Input type="date" {...register('start_date')} />
        </Field>
        {recurrenceType === 'WEEKLY' ? (
          <>
            <Field label="Day of week" error={errors.day_of_week?.message}>
              <Select {...register('day_of_week')}>
                {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </Select>
            </Field>
            <Field label="End date" error={errors.end_date?.message}>
              <Input type="date" {...register('end_date')} />
            </Field>
          </>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="schedule-notes">Notes</label>
          <textarea id="schedule-notes" rows={3} {...register('notes')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
        </div>
        {saveError ? <div className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" className="bg-slate-100 text-slate-700" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-slate-900 text-white" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Create schedule'}</Button>
        </div>
      </form>
    </Card>
  )
}

async function fetchExceptionHistory(occurrenceId: string): Promise<ScheduleException[]> {
  const { data, error } = await supabase
    .from('schedule_exceptions')
    .select('*')
    .eq('occurrence_id', occurrenceId)
    .order('created_at', { ascending: false })
    .returns<ScheduleException[]>()
  if (error) throw error
  return data ?? []
}

function exceptionLabel(type: ScheduleException['type']) {
  switch (type) {
    case 'RESCHEDULED': return 'Rescheduled'
    case 'CANCELLED': return 'Cancelled'
    case 'REPLACEMENT': return 'Teacher replaced'
    case 'MAKEUP': return 'Make-up created'
    case 'SKIPPED': return 'Skipped'
  }
}

function UpdateForm({ occurrence, lessonTimes, teachers, canManage, canDelete, onClose, onSaved }: { occurrence: ScheduleOccurrence; lessonTimes: LessonTime[]; teachers: Teacher[]; canManage: boolean; canDelete: boolean; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const historyQuery = useQuery({ queryKey: ['schedule-exceptions', occurrence.id], queryFn: () => fetchExceptionHistory(occurrence.id) })
  const [exceptionMode, setExceptionMode] = useState<'RESCHEDULE' | 'MAKEUP' | 'REPLACE' | null>(null)
  const [exceptionDate, setExceptionDate] = useState(occurrence.lesson_date)
  const [exceptionLessonTimeId, setExceptionLessonTimeId] = useState('')
  const [exceptionTeacherId, setExceptionTeacherId] = useState(occurrence.teacher_id)
  const [exceptionReason, setExceptionReason] = useState('')
  const currentSlot = lessonTimes.find((item) => item.start_time.slice(0, 5) === occurrence.start_time.slice(0, 5) && item.end_time.slice(0, 5) === occurrence.end_time.slice(0, 5))
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<UpdateData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      lesson_date: occurrence.lesson_date,
      lesson_time_id: currentSlot?.id ?? lessonTimes[0]?.id ?? '',
      status: occurrence.status,
      notes: occurrence.notes ?? '',
    },
  })

  const defaultExceptionSlot = currentSlot?.id ?? lessonTimes[0]?.id ?? ''

  async function onSubmit(values: UpdateData) {
    setSaveError(null)
    try {
      if (!canManage) {
        const { error } = await supabase.rpc('update_lesson_status', {
          p_occurrence_id: occurrence.id,
          p_status: values.status,
          p_notes: values.notes?.trim() || null,
        })
        if (error) throw error
      } else {
        const selectedSlot = lessonTimes.find((item) => item.id === values.lesson_time_id)
        if (!selectedSlot) throw new Error('Lesson time not found')
        const { error } = await supabase.rpc('update_schedule_occurrence', {
          p_occurrence_id: occurrence.id,
          p_lesson_date: values.lesson_date,
          p_start_time: selectedSlot.start_time,
          p_end_time: selectedSlot.end_time,
          p_status: values.status,
          p_notes: values.notes?.trim() || null,
        })
        if (error) throw error
      }
      await queryClient.invalidateQueries({ queryKey: ['schedule'] })
      onSaved()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update schedule')
    }
  }


  async function runExceptionAction() {
    if (!canManage || !exceptionMode) return
    setSaveError(null)
    try {
      const selectedSlot = lessonTimes.find((item) => item.id === (exceptionLessonTimeId || defaultExceptionSlot))
      if ((exceptionMode === 'RESCHEDULE' || exceptionMode === 'MAKEUP') && !selectedSlot) {
        throw new Error('Lesson time not found')
      }

      if (exceptionMode === 'RESCHEDULE') {
        const { error } = await supabase.rpc('reschedule_schedule_occurrence', {
          p_occurrence_id: occurrence.id,
          p_new_date: exceptionDate,
          p_new_start_time: selectedSlot!.start_time,
          p_new_end_time: selectedSlot!.end_time,
          p_reason: exceptionReason.trim() || null,
        })
        if (error) throw error
      } else if (exceptionMode === 'MAKEUP') {
        const { error } = await supabase.rpc('create_makeup_schedule_occurrence', {
          p_occurrence_id: occurrence.id,
          p_new_date: exceptionDate,
          p_new_start_time: selectedSlot!.start_time,
          p_new_end_time: selectedSlot!.end_time,
          p_reason: exceptionReason.trim() || null,
        })
        if (error) throw error
      } else {
        if (!exceptionTeacherId) throw new Error('Replacement teacher is required')
        const { error } = await supabase.rpc('replace_schedule_teacher', {
          p_occurrence_id: occurrence.id,
          p_new_teacher_id: exceptionTeacherId,
          p_reason: exceptionReason.trim() || null,
        })
        if (error) throw error
      }

      await queryClient.invalidateQueries({ queryKey: ['schedule'] })
      onSaved()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to apply schedule exception')
    }
  }

  async function cancelLesson() {
    if (!canManage) return
    const reason = window.prompt('Cancellation reason (optional):', '')
    if (reason === null) return
    if (!window.confirm('Cancel this lesson occurrence?')) return
    setSaveError(null)
    const { error } = await supabase.rpc('cancel_schedule_occurrence', {
      p_occurrence_id: occurrence.id,
      p_reason: reason.trim() || null,
    })
    if (error) {
      setSaveError(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['schedule'] })
    onSaved()
  }

  async function deleteOccurrence() {
    if (!canDelete || !window.confirm('Delete this lesson occurrence?')) return
    setSaveError(null)
    const { error } = await supabase.rpc('delete_schedule_occurrence', { p_occurrence_id: occurrence.id })
    if (error) {
      setSaveError(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['schedule'] })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Lesson details">
      <Card className="w-full max-w-lg p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">{occurrence.student?.name ?? 'Lesson'}</h2>
            <p className="mt-1 text-sm text-slate-500">{occurrence.subject?.name ?? 'Subject'} · {occurrence.teacher?.name ?? 'Teacher'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date"><Input type="date" disabled={!canManage} {...register('lesson_date')} /></Field>
            <Field label="Lesson time"><Select disabled={!canManage} {...register('lesson_time_id')}>{lessonTimes.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatTime(item.start_time)} - {formatTime(item.end_time)}</option>)}</Select></Field>
          </div>
          <Field label="Status"><Select {...register('status')}>
            {occurrence.status === 'CANCELLED' ? <option value="CANCELLED">Cancelled</option> : null}
            {!canManage ? null : <option value="SCHEDULED">Scheduled</option>}
            <option value="COMPLETED">Completed</option>
            <option value="NO_SHOW">No show</option>
          </Select></Field>
          <Field label="Notes"><textarea rows={3} {...register('notes')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" /></Field>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarClock size={16} /> Exception history</div>
            {historyQuery.isLoading ? <p className="text-xs text-slate-500">Loading history…</p> : historyQuery.isError ? <p className="text-xs text-red-600">Unable to load exception history.</p> : historyQuery.data?.length ? (
              <div className="space-y-2">
                {historyQuery.data.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-700">{exceptionLabel(item.type)}</span>
                      <span className="text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.reason || 'No reason recorded.'}</p>
                    {item.replacement_date ? <p className="mt-1 text-[11px] text-slate-400">Replacement: {formatDate(item.replacement_date)}{item.replacement_start ? ` · ${formatTime(item.replacement_start)}${item.replacement_end ? `–${formatTime(item.replacement_end)}` : ''}` : ''}</p> : null}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-500">No exceptions recorded for this lesson.</p>}
          </div>

          {canManage && occurrence.status !== 'COMPLETED' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarClock size={16} /> Schedule exceptions</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="bg-white text-slate-700" onClick={() => { setExceptionMode('RESCHEDULE'); setExceptionDate(occurrence.lesson_date); setExceptionLessonTimeId(defaultExceptionSlot); setExceptionReason('') }}><CalendarClock className="mr-2" size={15} /> Reschedule</Button>
                <Button type="button" className="bg-white text-slate-700" onClick={() => { setExceptionMode('MAKEUP'); setExceptionDate(addDays(occurrence.lesson_date, 1)); setExceptionReason(''); setExceptionLessonTimeId(defaultExceptionSlot) }}><CheckCircle2 className="mr-2" size={15} /> Create make-up</Button>
                <Button type="button" className="bg-white text-slate-700" onClick={() => { setExceptionMode('REPLACE'); setExceptionTeacherId(occurrence.teacher_id); setExceptionReason('') }}><UserRoundCog className="mr-2" size={15} /> Replace teacher</Button>
                <Button type="button" className="bg-red-50 text-red-700" onClick={() => void cancelLesson()}><ShieldAlert className="mr-2" size={15} /> Cancel lesson</Button>
              </div>
              {exceptionMode ? (
                <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                  {exceptionMode !== 'REPLACE' ? (
                    <Field label={exceptionMode === 'MAKEUP' ? 'Make-up date' : 'New date'}>
                      <Input type="date" value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} />
                    </Field>
                  ) : null}
                  {exceptionMode !== 'REPLACE' ? (
                    <Field label="Lesson time">
                      <Select value={exceptionLessonTimeId || defaultExceptionSlot} onChange={(event) => setExceptionLessonTimeId(event.target.value)}>
                        {lessonTimes.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatTime(item.start_time)} - {formatTime(item.end_time)}</option>)}
                      </Select>
                    </Field>
                  ) : (
                    <Field label="Replacement teacher">
                      <Select value={exceptionTeacherId} onChange={(event) => setExceptionTeacherId(event.target.value)}>
                        {teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </Select>
                    </Field>
                  )}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
                    <textarea value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} rows={2} maxLength={1000} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Button type="button" className="bg-slate-100 text-slate-700" onClick={() => setExceptionMode(null)}>Close action</Button>
                    <Button type="button" className="bg-slate-900 text-white" onClick={() => void runExceptionAction()}>Apply</Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {saveError ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>{canDelete ? <Button type="button" className="bg-red-50 text-red-700" onClick={() => void deleteOccurrence()}><Trash2 className="mr-2" size={16} /> Delete</Button> : null}</div>
            <div className="flex gap-2">
              <Button type="button" className="bg-slate-100 text-slate-700" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 text-white" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export function SchedulePage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'STAFF'
  const canDelete = profile?.role === 'ADMIN'
  const initialRange = useMemo(() => getQueryRange(), [])
  const [range, setRange] = useState(initialRange)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<ScheduleOccurrence | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ScheduleStatus>('ALL')

  useEffect(() => {
    if (searchParams.get('new') === '1' && !showForm) {
      setShowForm(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, showForm])

  const refs = useQuery({ queryKey: ['schedule-refs'], queryFn: fetchReferenceData })
  const schedule = useQuery({
    queryKey: ['schedule', range.start, range.end],
    queryFn: () => fetchOccurrences(range.start, range.end),
  })

  const isMobile = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches, [])
  const filteredOccurrences = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (schedule.data ?? []).filter((occurrence) => {
      const matchesStatus = statusFilter === 'ALL' || occurrence.status === statusFilter
      if (!matchesStatus) return false
      if (!term) return true
      return [occurrence.student?.name, occurrence.teacher?.name, occurrence.subject?.name, occurrence.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [schedule.data, search, statusFilter])

  const events = useMemo(() => filteredOccurrences.map((occurrence) => ({
    id: occurrence.id,
    title: occurrence.student?.name ?? 'Lesson',
    start: `${occurrence.lesson_date}T${occurrence.start_time}`,
    end: `${occurrence.lesson_date}T${occurrence.end_time}`,
    classNames: [`lesson-status-${occurrence.status.toLowerCase()}`],
    extendedProps: { occurrence },
  })), [filteredOccurrences])

  useEffect(() => {
    const occurrenceId = searchParams.get('occurrence')
    if (!occurrenceId || !schedule.data) return
    const occurrence = schedule.data.find((item) => item.id === occurrenceId)
    if (!occurrence) return
    setSelected(occurrence)
    const next = new URLSearchParams(searchParams)
    next.delete('occurrence')
    setSearchParams(next, { replace: true })
  }, [schedule.data, searchParams, setSearchParams])

  const headerToolbar = isMobile
    ? { left: 'prev,next today', center: 'title', right: 'listWeek,timeGridDay' }
    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }

  async function handleEventDrop(info: { event: { id: string; start: Date | null; end: Date | null; extendedProps: { occurrence?: ScheduleOccurrence } }; revert: () => void }) {
    setActionError(null)
    if (!canManage || !info.event.start) {
      info.revert()
      return
    }

    const occurrence = info.event.extendedProps.occurrence
    if (!occurrence || occurrence.status === 'COMPLETED') {
      info.revert()
      return
    }

    const newDate = toLocalDateInput(info.event.start)
    const newStart = toLocalTimeInput(info.event.start)
    const newEnd = info.event.end ? toLocalTimeInput(info.event.end) : occurrence.end_time

    const { error } = await supabase.rpc('reschedule_schedule_occurrence', {
      p_occurrence_id: occurrence.id,
      p_new_date: newDate,
      p_new_start_time: newStart,
      p_new_end_time: newEnd,
      p_reason: 'Moved from calendar',
    })

    if (error) {
      info.revert()
      setActionError(error.message || 'Unable to reschedule lesson from the calendar.')
      return
    }

    await schedule.refetch()
  }

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="View lessons by day, week, or month and keep conflicts out of the calendar."
        action={canManage ? <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => { setShowForm(true); setSearch(''); setStatusFilter('ALL') }}><Plus className="mr-2" size={16} /> Add schedule</Button> : <Button className="bg-slate-100 text-slate-700" onClick={() => void schedule.refetch()}><RefreshCw className="mr-2" size={16} /> Refresh</Button>}
      />

      {actionError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{actionError}</div> : null}

      <Card className="mb-5 p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search schedule</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, teacher, subject, or notes" className="pl-9" />
          </label>
          <label className="flex items-center gap-2 md:w-52">
            <Filter size={16} className="shrink-0 text-slate-400" />
            <span className="sr-only">Filter by status</span>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ScheduleStatus)}>
              <option value="ALL">All statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-show</option>
            </Select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-400">Showing {filteredOccurrences.length} of {(schedule.data ?? []).length} loaded lessons.</p>
      </Card>

      {showForm && refs.data ? <ScheduleForm refs={refs.data} initialDate={range.start > toLocalDateInput() ? range.start : undefined} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); void schedule.refetch() }} /> : null}

      {!canManage && refs.data && refs.data.teachers.length === 0 ? (
        <Card className="mb-5 p-4 text-sm text-amber-800 bg-amber-50">
          No active teacher is configured yet. Ask an administrator to create and link a teacher profile.
        </Card>
      ) : null}

      <Card className="overflow-hidden p-2 sm:p-3">
        {schedule.isLoading ? <div className="grid min-h-96 place-items-center text-sm text-slate-500">Loading schedule…</div> : schedule.isError ? (
          <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-red-600">{schedule.error instanceof Error ? schedule.error.message : 'Unable to load schedule.'}</p>
            <Button className="bg-slate-100 text-slate-700" onClick={() => void schedule.refetch()}><RefreshCw className="mr-2" size={16} /> Retry</Button>
          </div>
        ) : (
          <div className="schedule-calendar min-w-0">
            <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
              initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
              headerToolbar={headerToolbar}
              events={events}
              height="auto"
              nowIndicator
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="23:00:00"
              scrollTime="08:00:00"
              expandRows
              editable={canManage}
              eventStartEditable={canManage}
              eventDurationEditable={false}
              selectable={false}
              eventDrop={(info) => void handleEventDrop(info)}
              datesSet={(info) => setRange({ start: toLocalDateInput(info.start), end: toLocalDateInput(info.end) })}
              eventClick={(info) => setSelected(info.event.extendedProps.occurrence as ScheduleOccurrence)}
              eventContent={(info) => (
                <div className="overflow-hidden px-1 py-0.5 text-xs leading-tight">
                  <div className="font-semibold">{info.timeText}</div>
                  <div className="truncate">{info.event.title}</div>
                  <div className="truncate opacity-80">{String(info.event.extendedProps.occurrence?.subject?.name ?? '')}</div>
                </div>
              )}
            />
          </div>
        )}
      </Card>

      {schedule.data && schedule.data.length > 0 ? (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><CalendarPlus size={17} /> Loaded lessons</div>
          </div>
          {filteredOccurrences.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-medium text-slate-800">No matching lessons</p>
              <p className="mt-1 text-sm text-slate-500">Adjust the search or status filter.</p>
            </div>
          ) : null}
          {filteredOccurrences.length > 0 ? <div className="divide-y divide-slate-100">
            {filteredOccurrences.slice(0, 10).map((item) => (
              <button key={item.id} type="button" onClick={() => setSelected(item)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{item.student?.name ?? 'Student'}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{formatDate(item.lesson_date)} · {formatTime(item.start_time)} - {formatTime(item.end_time)} · {item.subject?.name ?? 'Subject'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>{item.status.replace('_', ' ')}</span>
              </button>
            ))}
          </div> : null}
        </Card>
      ) : null}

      {selected ? <UpdateForm occurrence={selected} lessonTimes={refs.data?.lessonTimes ?? []} teachers={refs.data?.teachers ?? []} canManage={canManage} canDelete={canDelete} onClose={() => setSelected(null)} onSaved={() => setSelected(null)} /> : null}
    </div>
  )
}

function statusClass(status: ScheduleStatus) {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-50 text-emerald-700'
    case 'CANCELLED': return 'bg-red-50 text-red-700'
    case 'NO_SHOW': return 'bg-amber-50 text-amber-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

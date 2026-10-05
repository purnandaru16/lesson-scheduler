import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CalendarPlus, Clock3, GraduationCap, RefreshCw, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader, Button } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { addDays, formatDate, formatTime, toLocalDateInput } from '@/lib/date'
import type { ScheduleOccurrence, ScheduleStatus } from '@/types/database'

async function fetchDashboard() {
  const today = toLocalDateInput()
  const tomorrow = addDays(today, 1)
  const upcomingEnd = addDays(today, 8)

  const [students, teachers, lessonTimes, todayLessons, upcomingLessons] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('lesson_times').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('schedule_occurrences')
      .select('*,student:students(name),teacher:teachers(name),subject:subjects(name)')
      .eq('lesson_date', today)
      .order('start_time')
      .returns<ScheduleOccurrence[]>(),
    supabase
      .from('schedule_occurrences')
      .select('*,student:students(name),teacher:teachers(name),subject:subjects(name)')
      .gte('lesson_date', tomorrow)
      .lt('lesson_date', upcomingEnd)
      .eq('status', 'SCHEDULED')
      .order('lesson_date')
      .order('start_time')
      .limit(8)
      .returns<ScheduleOccurrence[]>(),
  ])

  for (const result of [students, teachers, lessonTimes, todayLessons, upcomingLessons]) {
    if (result.error) throw result.error
  }

  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    lessonTimes: lessonTimes.count ?? 0,
    todayLessons: todayLessons.data ?? [],
    upcomingLessons: upcomingLessons.data ?? [],
  }
}

function statusClass(status: ScheduleStatus) {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-50 text-emerald-700'
    case 'CANCELLED': return 'bg-red-50 text-red-700'
    case 'NO_SHOW': return 'bg-amber-50 text-amber-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function LessonRow({ occurrence }: { occurrence: ScheduleOccurrence }) {
  return (
    <Link to={`/schedule?occurrence=${occurrence.id}`} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{occurrence.student?.name ?? 'Student'}</p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {formatTime(occurrence.start_time)} - {formatTime(occurrence.end_time)} · {occurrence.subject?.name ?? 'Subject'} · {occurrence.teacher?.name ?? 'Teacher'}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(occurrence.status)}`}>
        {occurrence.status.replace('_', ' ')}
      </span>
    </Link>
  )
}

export function DashboardPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard, staleTime: 30_000 })
  const data = query.data
  const cards = [
    { label: 'Students', value: data?.students ?? '—', icon: Users, href: '/students' },
    { label: 'Teachers', value: data?.teachers ?? '—', icon: GraduationCap, href: '/teachers' },
    { label: 'Lesson times', value: data?.lessonTimes ?? '—', icon: Clock3, href: '/lesson-times' },
    { label: "Today's lessons", value: data?.todayLessons.length ?? '—', icon: CalendarDays, href: '/schedule' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        description={formatDate(toLocalDateInput())}
        action={
          <Link to="/schedule?new=1">
            <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">
              <CalendarPlus className="mr-2" size={16} /> Quick add
            </Button>
          </Link>
        }
      />

      {query.isError ? (
        <Card className="border-red-200 bg-red-50 p-4" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-red-800">Unable to load the dashboard.</p>
              <p className="mt-1 text-sm text-red-700">{query.error instanceof Error ? query.error.message : 'Please try again.'}</p>
            </div>
            <Button className="bg-white text-slate-700" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-2" size={16} /> Retry
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} to={href}>
            <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3 text-slate-700"><Icon size={20} /></div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-900">Today's schedule</h2>
              <p className="mt-1 text-xs text-slate-500">All lessons scheduled for today.</p>
            </div>
            <Link to="/schedule" className="text-sm font-semibold text-slate-700 hover:text-slate-900">View calendar</Link>
          </div>
          {query.isLoading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : data?.todayLessons.length ? (
            <div className="divide-y divide-slate-100">
              {data.todayLessons.map((occurrence) => <LessonRow key={occurrence.id} occurrence={occurrence} />)}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="font-medium text-slate-800">No lessons today</p>
              <p className="mt-1 text-sm text-slate-500">Use Quick add to schedule the next lesson.</p>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-900">Upcoming</h2>
              <p className="mt-1 text-xs text-slate-500">Next seven days, excluding today.</p>
            </div>
            <Link to="/schedule" className="text-sm font-semibold text-slate-700 hover:text-slate-900">Open schedule</Link>
          </div>
          {query.isLoading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : data?.upcomingLessons.length ? (
            <div className="divide-y divide-slate-100">
              {data.upcomingLessons.map((occurrence) => (
                <Link key={occurrence.id} to={`/schedule?occurrence=${occurrence.id}`} className="block px-4 py-3 hover:bg-slate-50 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{occurrence.student?.name ?? 'Student'}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{formatDate(occurrence.lesson_date)} · {formatTime(occurrence.start_time)} · {occurrence.subject?.name ?? 'Subject'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">Scheduled</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="font-medium text-slate-800">No upcoming lessons</p>
              <p className="mt-1 text-sm text-slate-500">Your next seven days are clear.</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Daily workflow</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use the dashboard to review today, jump into the upcoming agenda, or create a lesson in one tap. Scheduling conflicts remain enforced by the database.
        </p>
      </Card>
    </div>
  )
}

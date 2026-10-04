import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock3, GraduationCap, Users } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toLocalDateInput } from '@/lib/date'

async function fetchDashboard() {
  const today = toLocalDateInput()
  const tomorrow = (() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return toLocalDateInput(date)
  })()

  const [students, teachers, lessonTimes, lessons] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('lesson_times').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('schedule_occurrences').select('*', { count: 'exact', head: true }).gte('lesson_date', today).lt('lesson_date', tomorrow).in('status', ['SCHEDULED', 'COMPLETED']),
  ])

  for (const result of [students, teachers, lessonTimes, lessons]) {
    if (result.error) throw result.error
  }

  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    lessonTimes: lessonTimes.count ?? 0,
    lessons: lessons.count ?? 0,
  }
}

export function DashboardPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard, staleTime: 30_000 })
  const data = query.data
  const cards = [
    { label: 'Students', value: data?.students ?? '—', icon: Users, href: '/students' },
    { label: 'Teachers', value: data?.teachers ?? '—', icon: GraduationCap, href: '/teachers' },
    { label: 'Lesson times', value: data?.lessonTimes ?? '—', icon: Clock3, href: '/lesson-times' },
    { label: "Today's lessons", value: data?.lessons ?? '—', icon: CalendarDays, href: '/schedule' },
  ]

  return (
    <div>
      <PageHeader title="Today" description="Your scheduling workspace is ready." />
      {query.isError ? <p className="mb-4 text-sm text-red-600">Unable to load dashboard metrics. The calendar and master-data pages are still available.</p> : null}
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
      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-slate-900">Scheduling workflow</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Create students, teachers, and lesson times first. Then use Schedule to create one-off or weekly lessons. The database checks student and teacher overlaps inside a transaction.
        </p>
      </Card>
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button, Card, Input, PageHeader } from '@/components/ui'
import { useAuth } from '@/features/auth/auth'
import { supabase } from '@/lib/supabase'
import type { LessonTime } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  active: z.boolean(),
})

type FormData = z.infer<typeof schema>

function durationInMinutes(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const duration = eh * 60 + em - (sh * 60 + sm)
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('End time must be after start time')
  return duration
}

async function fetchLessonTimes(): Promise<LessonTime[]> {
  const { data, error } = await supabase.from('lesson_times').select('*').order('start_time').returns<LessonTime[]>()
  if (error) throw error
  return data ?? []
}

function LessonTimeForm({ initial, onClose }: { initial?: LessonTime; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      start_time: initial?.start_time.slice(0, 5) ?? '',
      end_time: initial?.end_time.slice(0, 5) ?? '',
      active: initial?.active ?? true,
    },
  })

  async function onSubmit(values: FormData) {
    setSaveError(null)
    try {
      const payload = {
        name: values.name.trim(),
        start_time: values.start_time,
        end_time: values.end_time,
        duration_min: durationInMinutes(values.start_time, values.end_time),
        active: values.active,
      }
      const result = initial
        ? await supabase.from('lesson_times').update(payload).eq('id', initial.id)
        : await supabase.from('lesson_times').insert(payload)
      if (result.error) throw result.error
      await queryClient.invalidateQueries({ queryKey: ['lesson-times'] })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save lesson time')
    }
  }

  return (
    <Card className="mb-5 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{initial ? 'Edit lesson time' : 'New lesson time'}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
      </div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lesson-time-name">Name</label>
          <Input id="lesson-time-name" {...register('name')} autoFocus />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lesson-start">Start</label>
          <Input id="lesson-start" type="time" {...register('start_time')} />
          {errors.start_time ? <p className="mt-1 text-xs text-red-600">{errors.start_time.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lesson-end">End</label>
          <Input id="lesson-end" type="time" {...register('end_time')} />
          {errors.end_time ? <p className="mt-1 text-xs text-red-600">{errors.end_time.message}</p> : null}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700 sm:col-span-2">
          <input type="checkbox" className="size-4" {...register('active')} />
          Active
        </label>
        {saveError ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{saveError}</div> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" className="bg-slate-100 text-slate-700" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-slate-900 text-white" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Card>
  )
}

export function LessonTimesPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['lesson-times'], queryFn: fetchLessonTimes })
  const [editing, setEditing] = useState<LessonTime | undefined>()
  const [showForm, setShowForm] = useState(false)
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'STAFF'
  const lessonTimes = query.data ?? []

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lesson_times').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson-times'] })
    },
  })

  function openCreate() {
    setEditing(undefined)
    setShowForm(true)
  }

  return (
    <div>
      <PageHeader
        title="Lesson Times"
        description="Reusable standard time slots."
        action={canManage ? (
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={openCreate}>
            <Plus className="mr-2" size={16} /> Add lesson time
          </Button>
        ) : undefined}
      />

      {showForm ? <LessonTimeForm initial={editing} onClose={() => { setShowForm(false); setEditing(undefined) }} /> : null}

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-sm text-slate-500">Loading lesson times…</div>
        ) : query.isError ? (
          <div className="p-6 text-sm text-red-600">{query.error instanceof Error ? query.error.message : 'Unable to load lesson times.'}</div>
        ) : lessonTimes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-800">No lesson times yet</p>
            {canManage ? <Button className="mt-4 bg-slate-900 text-white" onClick={openCreate}>Add lesson time</Button> : null}
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessonTimes.map((slot) => (
              <div key={slot.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{slot.name}</p>
                    <p className="mt-2 text-sm text-slate-600">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</p>
                    <p className="mt-1 text-xs text-slate-400">{slot.duration_min} minutes</p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => { setEditing(slot); setShowForm(true) }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${slot.name}`}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => { if (window.confirm(`Delete ${slot.name}?`)) void deleteMutation.mutateAsync(slot.id) }} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${slot.name}`} disabled={deleteMutation.isPending}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : null}
                </div>
                <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${slot.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {slot.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

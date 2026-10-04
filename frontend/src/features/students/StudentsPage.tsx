import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button, Card, Input, PageHeader } from '@/components/ui'
import { useAuth } from '@/features/auth/auth'
import { supabase } from '@/lib/supabase'
import type { Student } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  birth_date: z.string().optional(),
  address: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
})

type FormData = z.infer<typeof schema>

async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').order('name').returns<Student[]>()
  if (error) throw error
  return data ?? []
}

function StudentForm({
  initial,
  onClose,
}: {
  initial?: Student
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      birth_date: initial?.birth_date ?? '',
      address: initial?.address ?? '',
      notes: initial?.notes ?? '',
    },
  })

  async function onSubmit(values: FormData) {
    setSaveError(null)
    const payload = {
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      birth_date: values.birth_date || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
    }

    try {
      const result = initial
        ? await supabase.from('students').update(payload).eq('id', initial.id)
        : await supabase.from('students').insert(payload)
      if (result.error) throw result.error
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save student')
    }
  }

  return (
    <Card className="mb-5 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{initial ? 'Edit student' : 'New student'}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="student-name">Name</label>
          <Input id="student-name" {...register('name')} autoFocus />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="student-phone">Phone</label>
          <Input id="student-phone" {...register('phone')} inputMode="tel" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="student-email">Email</label>
          <Input id="student-email" type="email" {...register('email')} />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="student-birth-date">Birth date</label>
          <Input id="student-birth-date" type="date" {...register('birth_date')} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="student-address">Address</label>
          <Input id="student-address" {...register('address')} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="student-notes">Notes</label>
          <textarea id="student-notes" rows={3} {...register('notes')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
        </div>
        {saveError ? <div className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" className="bg-slate-100 text-slate-700" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-slate-900 text-white" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Card>
  )
}

export function StudentsPage() {
  const { profile } = useAuth()
  const query = useQuery({ queryKey: ['students'], queryFn: fetchStudents })
  const [editing, setEditing] = useState<Student | undefined>()
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'STAFF'
  const students = query.data ?? []

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })

  function openCreate() {
    setEditing(undefined)
    setShowForm(true)
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Master data for your students."
        action={canManage ? (
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={openCreate}>
            <Plus className="mr-2" size={16} /> Add student
          </Button>
        ) : undefined}
      />

      {showForm ? (
        <StudentForm
          initial={editing}
          onClose={() => {
            setShowForm(false)
            setEditing(undefined)
          }}
        />
      ) : null}

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-sm text-slate-500">Loading students…</div>
        ) : query.isError ? (
          <div className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-red-600">{query.error instanceof Error ? query.error.message : 'Unable to load students.'}</p>
            <Button className="bg-slate-100 text-slate-700" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-2" size={16} /> Retry
            </Button>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-800">No students yet</p>
            <p className="mt-1 text-sm text-slate-500">Add your first student to start building the schedule.</p>
            {canManage ? <Button className="mt-4 bg-slate-900 text-white" onClick={openCreate}>Add student</Button> : null}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {students.map((student) => (
              <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{student.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{student.phone ?? student.email ?? 'No contact information'}</p>
                </div>
                <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${student.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {student.status}
                </span>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(student)
                        setShowForm(true)
                      }}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Edit ${student.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete ${student.name}?`)) void deleteMutation.mutateAsync(student.id)
                      }}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${student.name}`}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

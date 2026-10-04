import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Card, Input, PageHeader, Select } from '@/components/ui'
import { useAuth } from '@/features/auth/auth'
import { supabase } from '@/lib/supabase'
import type { Profile, Teacher } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  profile_id: z.string().uuid().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>
type ProfileOption = Pick<Profile, 'id' | 'full_name' | 'role' | 'active'>

async function fetchTeachers(): Promise<Teacher[]> {
  const { data, error } = await supabase.from('teachers').select('*').order('name').returns<Teacher[]>()
  if (error) throw error
  return data ?? []
}

async function fetchProfiles(): Promise<ProfileOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,role,active')
    .eq('active', true)
    .order('full_name')
    .returns<ProfileOption[]>()
  if (error) throw error
  return data ?? []
}

function TeacherForm({ initial, profiles, onClose }: { initial?: Teacher; profiles: ProfileOption[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      profile_id: initial?.profile_id ?? '',
    },
  })

  async function onSubmit(values: FormData) {
    setSaveError(null)
    const payload = {
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      profile_id: values.profile_id || null,
    }

    try {
      const result = initial
        ? await supabase.from('teachers').update(payload).eq('id', initial.id)
        : await supabase.from('teachers').insert(payload)
      if (result.error) throw result.error
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save teacher')
    }
  }

  return (
    <Card className="mb-5 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{initial ? 'Edit teacher' : 'New teacher'}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="teacher-name">Name</label>
          <Input id="teacher-name" {...register('name')} autoFocus />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="teacher-phone">Phone</label>
          <Input id="teacher-phone" {...register('phone')} inputMode="tel" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="teacher-email">Email</label>
          <Input id="teacher-email" type="email" {...register('email')} />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="teacher-profile">Login profile (optional)</label>
          <Select id="teacher-profile" {...register('profile_id')}>
            <option value="">Not linked</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name || 'Unnamed user'} · {profile.role}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">Linking a profile lets that account see its own assigned schedule.</p>
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

export function TeachersPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: fetchTeachers })
  const profiles = useQuery({ queryKey: ['profiles-for-teachers'], queryFn: fetchProfiles })
  const [editing, setEditing] = useState<Teacher | undefined>()
  const [showForm, setShowForm] = useState(false)
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'STAFF'
  const canDelete = profile?.role === 'ADMIN'
  const teacherRows = teachers.data ?? []

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teachers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  })

  return (
    <div>
      <PageHeader
        title="Teachers"
        description="Manage teachers and optionally link them to login accounts."
        action={canManage ? (
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => { setEditing(undefined); setShowForm(true) }}>
            <Plus className="mr-2" size={16} /> Add teacher
          </Button>
        ) : undefined}
      />

      {showForm ? (
        <TeacherForm
          initial={editing}
          profiles={profiles.data ?? []}
          onClose={() => { setShowForm(false); setEditing(undefined) }}
        />
      ) : null}

      <Card className="overflow-hidden">
        {teachers.isLoading ? (
          <div className="p-6 text-sm text-slate-500">Loading teachers…</div>
        ) : teachers.isError ? (
          <div className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-red-600">{teachers.error instanceof Error ? teachers.error.message : 'Unable to load teachers.'}</p>
            <Button className="bg-slate-100 text-slate-700" onClick={() => void teachers.refetch()}><RefreshCw className="mr-2" size={16} /> Retry</Button>
          </div>
        ) : teacherRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-800">No teachers yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a teacher before assigning lessons.</p>
            {canManage ? <Button className="mt-4 bg-slate-900 text-white" onClick={() => { setEditing(undefined); setShowForm(true) }}>Add teacher</Button> : null}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {teacherRows.map((teacher) => (
              <div key={teacher.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{teacher.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{teacher.phone ?? teacher.email ?? 'No contact information'}</p>
                  <p className="mt-1 text-xs text-slate-400">{teacher.profile_id ? 'Login linked' : 'No login linked'}</p>
                </div>
                <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${teacher.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{teacher.status}</span>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => { setEditing(teacher); setShowForm(true) }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`Edit ${teacher.name}`}><Pencil size={16} /></button>
                    {canDelete ? <button type="button" onClick={() => { if (window.confirm(`Delete ${teacher.name}?`)) void deleteMutation.mutateAsync(teacher.id) }} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${teacher.name}`} disabled={deleteMutation.isPending}><Trash2 size={16} /></button> : null}
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

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button, Card, Input } from '@/components/ui'
import { useAuth } from './auth'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormData) => {
    setError(null)
    try {
      await signIn(values.email, values.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-500">Lesson Scheduler</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Manage lessons from your phone or desktop.</p>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
          </div>
          {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </main>
  )
}

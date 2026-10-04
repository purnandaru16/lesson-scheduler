import { CalendarDays, Clock3, GraduationCap, Home, LogOut, Users } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/teachers', label: 'Teachers', icon: GraduationCap },
  { to: '/lesson-times', label: 'Lesson Time', icon: Clock3 },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
]

export function AppShell() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white">
              <GraduationCap size={20} />
            </div>
            <div>
              <div className="font-bold leading-none text-slate-900">Lesson Scheduler</div>
              <div className="mt-1 text-xs text-slate-500">{profile?.full_name ?? 'User'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 md:flex"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-4 md:block">
          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:py-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] ${
                  isActive ? 'bg-slate-900 font-semibold text-white' : 'text-slate-500'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

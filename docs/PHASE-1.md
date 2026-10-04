# Phase 1 Implementation Notes

This increment establishes the runnable frontend shell, authentication, security foundation, and master-data CRUD screens.

## Included

- React/Vite application shell
- Mobile-first responsive navigation
- Supabase client configuration
- Email/password authentication
- Protected routes
- Profile and RBAC model
- RLS policies
- Student CRUD
- Lesson-time CRUD
- Initial subjects and lesson-time seed data
- Conflict-safe schedule occurrence RPC foundation

## Before running the app

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/20261004000100_initial_schema.sql`.
3. Create the first user in Supabase Auth.
4. Promote that first user to ADMIN using SQL:

```sql
update public.profiles
set role = 'ADMIN'
where id = '<AUTH_USER_UUID>';
```

5. Copy `frontend/.env.example` to `frontend/.env.local` and set the project URL and publishable key.
6. Run `npm install` from the repository root.
7. Run `npm run dev`.

## Next increment

The next implementation step is the scheduling module: calendar views, recurring schedules, occurrence generation, reschedule/cancel workflows, and conflict-safe mutations through RPCs.

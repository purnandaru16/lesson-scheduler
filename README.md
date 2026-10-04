# Lesson Scheduler

Mobile-first lesson scheduling app. Current implementation uses React + TypeScript + Supabase + Cloudflare Pages as defined in `DESIGN.md`.

## Current increment

- Authentication and protected routes
- Student CRUD
- Teacher CRUD with optional login-profile linking
- Lesson Time CRUD
- Schedule calendar using FullCalendar 7
- One-off schedule creation
- Weekly recurring schedule materialized into occurrences
- Server-side conflict detection for student/teacher overlaps
- Staff/admin reschedule and status update
- Teacher status-only update
- Admin occurrence deletion
- Calendar drag/drop reschedule with server-side conflict rollback
- Lesson exception history and exception-aware teacher visibility
- PostgreSQL RLS and least-privilege table grants

## Prerequisites

- Node.js 22+
- npm 10+
- Docker-compatible runtime for local Supabase

## Local setup

The repository now supports a fully local Supabase development workflow. The recommended development path is:

```bash
npm install
npm run db:start
npm run db:reset
npm run dev:local
```

This starts PostgreSQL/Auth/Studio locally, applies all migrations, loads `supabase/seed.sql`, generates the browser-safe frontend environment file, and starts Vite. See `docs/LOCAL-DEVELOPMENT.md` for details.

For local login, create a user in Supabase Studio at `http://127.0.0.1:54323`. New users receive the default `STAFF` role. Promote the first local user to `ADMIN` with:

```sql
update public.profiles
set role = 'ADMIN'
where id = 'YOUR_AUTH_USER_UUID';
```

The previous cloud-based workflow is still supported. Set `frontend/.env.local` to a hosted Supabase URL + publishable key and use the same migrations against the remote development project.

## Database security

Never expose a Supabase `service_role` key in the frontend. Frontend access uses the anon key + authenticated session + PostgreSQL RLS. Schedule writes are intentionally routed through security-definer RPCs so overlap validation stays server-side.

## Build

```bash
npm run typecheck
npm run build
```

The development environment used to generate this increment did not have the npm package registry available, so the final dependency installation/build must be run in an environment with network access.


## Current implementation

### Phase 4 - Local Supabase Development

The repository now includes `supabase/config.toml`, reproducible local seed data, npm scripts for local Supabase lifecycle management, and automatic generation of the frontend local environment.

### Phase 3 - Schedule Exception Engine

The current increment supports cancelling, rescheduling, making up, and replacing the teacher for individual lesson occurrences. Each operation is protected by PostgreSQL RPC authorization and writes an exception/audit record.

See `docs/PHASE-3.md` for details.

### Supabase Cloud migration

For a hosted development/staging or production project, use the migration helper in `docs/CLOUD-MIGRATION.md`. It performs `link -> migration list -> db push --dry-run` first and requires an explicit `CONFIRM_CLOUD_MIGRATION=YES` before the real push. Seed data is never included by the helper.

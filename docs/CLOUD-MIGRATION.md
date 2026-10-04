# Supabase Cloud Migration

This repository treats migration files under `supabase/migrations/` as the source of truth. Hosted Supabase schema changes must be applied through migrations, not by making ad-hoc schema edits in the remote SQL/Table editor.

## Preconditions

For a new hosted development/staging project, create the Supabase project first and note its project ref from the dashboard URL:

```text
https://supabase.com/dashboard/project/<project-ref>
```

Set the following environment variables in your shell or CI secret store:

```bash
export SUPABASE_PROJECT_ID="your-project-ref"
export SUPABASE_DB_PASSWORD="your-project-db-password"
export SUPABASE_ACCESS_TOKEN="sbp_..."   # optional when already logged in locally
```

For automation, prefer a scoped Supabase personal access token rather than a classic token. The token should be scoped to the target project with the minimum permissions required for the workflow.

## Fresh remote project

For a brand-new empty project, inspect the migration plan first:

```bash
npm install
npm run db:cloud:dry-run
```

The command links the local repo to the target project, prints remote migration history, and runs `supabase db push --dry-run`. Nothing is changed during this step.

After reviewing the result, authorize the actual migration explicitly:

```bash
export CONFIRM_CLOUD_MIGRATION=YES
npm run db:cloud:push
```

The push applies only migration files that are not already recorded in the remote migration history. The helper intentionally does **not** use `--include-seed`, so `supabase/seed.sql` cannot be accidentally loaded into production.

## Existing remote project

If the hosted database already contains schema changes that are not represented in this repository, do not push this repository blindly. First link the project and inspect the remote schema/history:

```bash
npx supabase link --project-ref "$SUPABASE_PROJECT_ID"
npx supabase migration list --linked
npx supabase db pull
```

`db pull` creates a migration representing remote changes so local migrations and the hosted schema can be reconciled before deployment. After reconciling the repository, reset the local database and verify the migration sequence:

```bash
npm run db:reset
npm run typecheck
npm run build
```

Only after the history is aligned should the migration be pushed.

## Production safety

- Never run `supabase db reset --linked` against production; it is destructive.
- Never use `supabase db push --include-seed` against production. Seed data is development/test data.
- Never place `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, a service-role key, or a secret key in `frontend/.env.*`.
- The browser should receive only the Supabase project URL and browser-safe publishable/anon key.
- Keep database changes in `supabase/migrations/` and review them before deployment.

## Post-migration verification

After the push, verify in Supabase SQL Editor that the main application tables have RLS enabled:

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'teachers',
    'students',
    'subjects',
    'lesson_times',
    'schedule_series',
    'schedule_occurrences',
    'schedule_exceptions',
    'audit_logs'
  )
order by tablename;
```

Also verify the scheduling RPCs exist:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_schedule_plan',
    'create_schedule_occurrence',
    'update_schedule_occurrence',
    'update_lesson_status',
    'cancel_schedule_occurrence',
    'reschedule_schedule_occurrence',
    'replace_schedule_teacher',
    'create_makeup_schedule_occurrence'
  )
order by routine_name;
```

Finally, create the first Auth user in the hosted project and promote it to `ADMIN` using the SQL Editor. The migration's auth trigger creates its `public.profiles` row with the default `STAFF` role before the promotion.

## Phase 4 local development

Once the cloud migration target is established, local development remains reproducible and isolated from the hosted database:

```bash
npm install
npm run db:start
npm run db:reset
npm run db:env
npm run dev
```

This applies all repository migrations and the synthetic `supabase/seed.sql` only to the local Supabase stack. See `docs/LOCAL-DEVELOPMENT.md` for the daily workflow.

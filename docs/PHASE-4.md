# Phase 4 - Supabase Development & Cloud Migration

## Objective

Keep the database reproducible locally while making hosted Supabase deployment migration-based, reviewable, and safe for development/staging/production.

## Delivered

### Local development

- `supabase/config.toml` for repository-managed local configuration.
- `supabase/seed.sql` with synthetic development-only sample data.
- Supabase CLI added as a root dev dependency.
- NPM scripts for local Supabase lifecycle:
  - `npm run db:start`
  - `npm run db:stop`
  - `npm run db:reset`
  - `npm run db:status`
  - `npm run db:env`
  - `npm run db:types`
- `npm run dev:local` convenience command.
- Automatic generation of `frontend/.env.local` using the local API URL and browser-safe publishable/anon key.
- Local development guide in `docs/LOCAL-DEVELOPMENT.md`.

### Supabase Cloud migration workflow

- `npm run db:cloud:dry-run` previews pending hosted migrations.
- `npm run db:cloud:push` applies migrations only after explicit `CONFIRM_CLOUD_MIGRATION=YES`.
- Cloud migration helper requires a target `SUPABASE_PROJECT_ID`/`SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` for deterministic execution.
- Remote migration history is inspected before and after the push.
- `supabase/seed.sql` is never included in the cloud push helper.
- Calendar drag/drop rescheduling routes through `reschedule_schedule_occurrence` and automatically reverts on a server-side conflict.
- Lesson detail views show exception history for the selected occurrence.
- Exception-history RLS also lets a currently assigned replacement teacher view the occurrence's history.
- `.gitignore` now excludes local environment files, Supabase machine state, and generated frontend build artifacts.
- Cloud migration procedure and post-migration verification SQL are documented in `docs/CLOUD-MIGRATION.md`.

## Security decisions

The environment generator writes only browser-safe values into `frontend/.env.local`. It does not copy the local Supabase service-role/secret key into the Vite environment.

Seed data contains only synthetic test records and no credentials.

Cloud credentials are supplied through shell/CI secrets and are never written into repository files.

## Acceptance criteria

A fresh checkout with Node.js, npm, and a Docker-compatible runtime can run:

```bash
npm install
npm run db:start
npm run db:reset
npm run dev:local
```

and get a reproducible database plus a running frontend.

A hosted migration can be reviewed and applied with:

```bash
export SUPABASE_PROJECT_ID="your-project-ref"
export SUPABASE_DB_PASSWORD="your-project-db-password"
npm run db:cloud:dry-run

export CONFIRM_CLOUD_MIGRATION=YES
npm run db:cloud:push
```

The local/cloud workflow keeps the same migration source of truth under `supabase/migrations/`.

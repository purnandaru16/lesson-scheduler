# Local Development

The repository now supports a fully local Supabase development workflow.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker-compatible runtime
  - macOS: OrbStack is recommended by Supabase
  - Windows/Linux: Docker Desktop is recommended
- At least about 7 GB RAM available for the full local Supabase stack

Supabase runs PostgreSQL, Auth, Studio, Storage and supporting services locally in a Docker-compatible runtime. See the official local-development guide for current runtime requirements.

## First run

From the repository root:

```bash
npm install
npm run db:start
npm run db:reset
npm run db:env
npm run dev
```

`db:reset` destroys the local database and recreates it from all migrations, then runs `supabase/seed.sql`. This makes the database reproducible for every developer.

`db:env` reads the local Supabase status and writes only the browser-safe API URL + publishable/anon key to `frontend/.env.local`. It deliberately does not copy the service-role/secret key into the frontend environment.

The combined shortcut is:

```bash
npm run db:start
npm run dev:local
```

On the first run, `supabase start` may take a while because Docker images need to be downloaded.

## Local services

Default URLs:

```text
Frontend: http://localhost:5173
Supabase API: http://127.0.0.1:54321
PostgreSQL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio: http://127.0.0.1:54323
Inbucket: http://127.0.0.1:54324
```

Use:

```bash
npm run db:status
```

to see the current URLs and local keys.

## Create a local login user

The seed deliberately does not contain a real password. After starting the stack, open Supabase Studio:

```text
http://127.0.0.1:54323
```

Then create a user under **Authentication**.

The migration trigger automatically creates a `public.profiles` row with the default `STAFF` role.

To promote your local test account to `ADMIN`, open the SQL Editor in Studio and run:

```sql
update public.profiles
set role = 'ADMIN'
where id = 'YOUR_AUTH_USER_UUID';
```

## Seed data

`supabase/seed.sql` provides:

- sample students
- sample teachers
- sample subjects
- sample lesson times
- sample weekly schedule
- sample one-off lesson

No production data or credentials belong in `seed.sql`.

## Daily workflow

Start local Supabase if it is not already running:

```bash
npm run db:start
```

Start the application:

```bash
npm run dev:local
```

When you need a clean database:

```bash
npm run db:reset
npm run db:env
```

When you are done for the day:

```bash
npm run db:stop
```

## Database changes

Create a new migration instead of editing an already-applied migration:

```bash
npx supabase migration new <change-name>
```

Apply and verify locally:

```bash
npm run db:reset
```

Generate TypeScript database types when the schema changes:

```bash
npm run db:types
```

Commit migration files, `supabase/config.toml`, and `supabase/seed.sql`.

Do not commit:

```text
supabase/.temp/
supabase/.branches/
frontend/.env.local
```

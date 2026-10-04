import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migrationsDir = path.join(root, 'supabase', 'migrations')
const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()

if (migrationFiles.length === 0) {
  throw new Error('No Supabase migrations found.')
}

const names = migrationFiles.map((name) => name.split('_')[0])
const uniqueNames = new Set(names)
if (uniqueNames.size !== names.length) {
  throw new Error('Duplicate Supabase migration timestamps found.')
}

const fullSql = migrationFiles.map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n')
for (const fn of [
  'create_schedule_plan',
  'create_schedule_occurrence',
  'update_schedule_occurrence',
  'update_lesson_status',
  'delete_schedule_occurrence',
  'cancel_schedule_occurrence',
  'reschedule_schedule_occurrence',
  'replace_schedule_teacher',
  'create_makeup_schedule_occurrence',
]) {
  if (!new RegExp(`create(?: or replace)? function public\\.${fn}\\b`, 'i').test(fullSql)) {
    throw new Error(`Required RPC missing: ${fn}`)
  }
}

if (!/alter table public\.schedule_occurrences enable row level security;/i.test(fullSql)) {
  throw new Error('schedule_occurrences RLS enablement is missing.')
}

if (!fs.existsSync(path.join(root, 'supabase', 'seed.sql'))) {
  throw new Error('supabase/seed.sql is missing.')
}

const cloudScript = fs.readFileSync(path.join(root, 'scripts', 'migrate-cloud.mjs'), 'utf8')
if (cloudScript.includes('--include-seed') || cloudScript.includes('include-seed')) {
  throw new Error('Cloud migration helper must never include seed data.')
}
if (!cloudScript.includes('CONFIRM_CLOUD_MIGRATION')) {
  throw new Error('Cloud migration helper is missing explicit push confirmation.')
}

console.log(`Project validation passed: ${migrationFiles.length} migrations, required RPCs, RLS, seed, and cloud-push guardrails.`)

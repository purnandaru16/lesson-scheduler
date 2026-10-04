import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const push = args.has('--push')

if (dryRun === push) {
  console.error('Usage: node scripts/migrate-cloud.mjs --dry-run | --push')
  process.exit(2)
}

const projectRef = process.env.SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_REF
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!projectRef) {
  console.error('Missing SUPABASE_PROJECT_ID (or SUPABASE_PROJECT_REF).')
  process.exit(2)
}

if (push && !dbPassword) {
  console.error('SUPABASE_DB_PASSWORD is required for a deterministic cloud push.')
  process.exit(2)
}

if (push && process.env.CONFIRM_CLOUD_MIGRATION !== 'YES') {
  console.error('Refusing cloud migration. Set CONFIRM_CLOUD_MIGRATION=YES to authorize db push.')
  process.exit(2)
}

const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const env = {
  ...process.env,
  ...(accessToken ? { SUPABASE_ACCESS_TOKEN: accessToken } : {}),
  ...(dbPassword ? { SUPABASE_DB_PASSWORD: dbPassword } : {}),
}

function runSupabase(subArgs, label) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(npmCommand, ['--no-install', 'supabase', ...subArgs], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runSupabase(['link', '--project-ref', projectRef], `Link Supabase project ${projectRef}`)
runSupabase(['migration', 'list', '--linked'], 'Inspect remote migration history')
runSupabase(['db', 'push', '--dry-run'], 'Preview pending migrations')

if (dryRun) {
  console.log('\nDry-run complete. No remote schema was changed.')
  process.exit(0)
}

runSupabase(['db', 'push'], 'Apply pending migrations to Supabase Cloud')
runSupabase(['migration', 'list', '--linked'], 'Verify remote migration history')
console.log('\nCloud migration completed. Seed data was intentionally not deployed.')
